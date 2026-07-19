import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { flashBetsMode } from "@/lib/app-mode";
import { ReplayEngine } from "@/lib/replay/replay-engine";
import {
  REPLAY_SPEEDS,
  type ReplaySpeed,
  type ReplayState,
} from "@/lib/replay/types";
import { registerApplicationClock } from "@/lib/server/application-clock";
import { ApiError } from "@/lib/server/errors";
import { ingestTxLineScores } from "@/lib/server/market-service";
import { listMarketsForFixture } from "@/lib/server/repositories/market-repository";
import { listCompletedFixtures } from "@/lib/server/repositories/fixture-repository";
import { loadReplayDataset, listReplayDatasets } from "@/lib/server/replay/replay-loader";
import { settleMarket } from "@/lib/server/settlement-service";
import type { DashboardFixture } from "@/lib/types/dashboard";
import type { TxLineScoresUpdate, TxLineStreamMessage } from "@/lib/types/txline";

type Listener = (message: TxLineStreamMessage) => void;

interface ReplayRuntime {
  active: ReplayEngine | null;
  latestScores: TxLineScoresUpdate | null;
  listeners: Map<string, Set<Listener>>;
  serial: Promise<unknown>;
  nextVirtualEpochMs: number;
}

const globalReplay = globalThis as typeof globalThis & {
  __flashBetsReplayRuntime?: ReplayRuntime;
};

const runtime = (globalReplay.__flashBetsReplayRuntime ??= {
  active: null,
  latestScores: null,
  listeners: new Map(),
  serial: Promise.resolve(),
  nextVirtualEpochMs: 0,
});

function requireReplayMode(): void {
  if (flashBetsMode() !== "REPLAY") {
    throw new ApiError("REPLAY_MODE_DISABLED", "Replay Mode is not enabled", 409);
  }
}

function publish(fixtureId: number, message: TxLineStreamMessage): void {
  for (const listener of runtime.listeners.get(String(fixtureId)) ?? []) listener(message);
}

function fixtureIdForRun(runId: string): number {
  const digest = createHash("sha256").update(runId).digest();
  return 9_000_000_000 + digest.readUInt32BE(0);
}

async function closeActiveReplay(): Promise<void> {
  const engine = runtime.active;
  const scores = runtime.latestScores;
  if (!engine) return;
  const state = engine.pause();
  engine.dispose();
  runtime.active = null;

  if (scores && scores.fixtureId === state.fixtureId) {
    const abandoned: TxLineScoresUpdate = {
      ...scores,
      seq: scores.seq + 1,
      ts: state.virtualNowMs,
      matchPhase: "ABANDONED",
      sourceState: "ABANDONED",
      event: undefined,
    };
    await ingestTxLineScores(abandoned, state.virtualNowMs, {
      sourceMode: "REPLAY",
      sourceLabel: `Replay:${state.replayId}`,
      replayId: state.replayId,
      replayRunId: state.runId,
    });
    const markets = await listMarketsForFixture(String(state.fixtureId));
    for (const market of markets) {
      if (market.status === "SETTLED" || market.status === "VOID") continue;
      const settleAt = Math.max(state.virtualNowMs, new Date(market.settlesAt).getTime());
      try {
        await settleMarket(market.marketId, settleAt);
      } catch {
        console.error("[ReplayService] interrupted market could not be voided");
      }
    }
  }
  runtime.latestScores = null;
  runtime.nextVirtualEpochMs = Math.max(
    runtime.nextVirtualEpochMs,
    state.virtualNowMs + 60_000,
  );
}

async function performSelect(replayId: string): Promise<ReplayState> {
  requireReplayMode();
  let dataset;
  try {
    dataset = await loadReplayDataset(replayId);
  } catch {
    console.error("[ReplayService] replay dataset could not be loaded");
    throw new ApiError("REPLAY_NOT_FOUND", "The selected replay is missing or invalid", 404);
  }
  await closeActiveReplay();
  const runId = randomUUID();
  const fixtureId = fixtureIdForRun(runId);
  const virtualEpochMs = Math.max(Date.now(), runtime.nextVirtualEpochMs);
  runtime.nextVirtualEpochMs = virtualEpochMs + dataset.durationMs + 60_000;

  const engine = new ReplayEngine({
    dataset,
    runId,
    fixtureId,
    virtualEpochMs,
    emit: async (scores, virtualNowMs) => {
      const accepted = await ingestTxLineScores(scores, virtualNowMs, {
        sourceMode: "REPLAY",
        sourceLabel: `Replay:${dataset.id}`,
        replayId: dataset.id,
        replayRunId: runId,
      });
      if (!accepted) return;
      runtime.latestScores = scores;
      publish(fixtureId, { type: "scores", data: scores });
    },
    onState: (state) => publish(fixtureId, { type: "replay-state", data: state }),
  });
  runtime.active = engine;
  registerApplicationClock(() => runtime.active?.getState().virtualNowMs ?? Date.now());
  try {
    return await engine.initialize();
  } catch (error) {
    engine.dispose();
    runtime.active = null;
    runtime.latestScores = null;
    throw error;
  }
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = runtime.serial.then(operation, operation);
  runtime.serial = result.then(() => undefined, () => undefined);
  return result;
}

export function currentReplayState(): ReplayState | null {
  return runtime.active?.getState() ?? null;
}

export async function selectReplay(replayId: string): Promise<ReplayState> {
  return serialize(() => performSelect(replayId));
}

export async function controlReplay(input: {
  action: "PLAY" | "PAUSE" | "RESTART" | "SPEED";
  speed?: number;
}): Promise<ReplayState> {
  return serialize(async () => {
    requireReplayMode();
    const engine = runtime.active;
    if (!engine) throw new ApiError("REPLAY_NOT_SELECTED", "Choose a replay first", 409);
    if (input.action === "RESTART") return performSelect(engine.getState().replayId);
    if (input.action === "PLAY") return engine.play();
    if (input.action === "PAUSE") return engine.pause();
    if (input.action === "SPEED") {
      if (!REPLAY_SPEEDS.includes(input.speed as ReplaySpeed)) {
        throw new ApiError("INVALID_REPLAY_SPEED", "Replay speed must be 0.5, 1, 2, 5, or 10", 400);
      }
      return engine.setSpeed(input.speed as ReplaySpeed);
    }
    throw new ApiError("INVALID_REPLAY_ACTION", "Unknown replay action", 400);
  });
}

export function hasActiveReplayFixture(fixtureId: string): boolean {
  return String(runtime.active?.getState().fixtureId ?? "") === fixtureId;
}

export function subscribeReplay(fixtureId: string, listener: Listener): () => void {
  const set = runtime.listeners.get(fixtureId) ?? new Set<Listener>();
  set.add(listener);
  runtime.listeners.set(fixtureId, set);
  const state = runtime.active?.getState();
  if (state && String(state.fixtureId) === fixtureId) {
    if (runtime.latestScores) listener({ type: "scores", data: runtime.latestScores });
    listener({ type: "replay-state", data: state });
  }
  return () => {
    const current = runtime.listeners.get(fixtureId);
    current?.delete(listener);
    if (current?.size === 0) runtime.listeners.delete(fixtureId);
  };
}

export async function listReplayDashboardFixtures(): Promise<DashboardFixture[]> {
  const active = currentReplayState();
  const datasetsRequest = listReplayDatasets();
  const completedRequest = listCompletedFixtures("REPLAY").catch(() => {
    console.error("[ReplayService] completed replay history unavailable");
    return [];
  });
  const [datasets, completed] = await Promise.all([datasetsRequest, completedRequest]);
  const datasetsById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  const catalog = datasets.map((dataset): DashboardFixture => {
    const isActive = active?.replayId === dataset.id && active.status !== "FINISHED";
    return {
      id: isActive ? active.fixtureId : dataset.fixture.fixtureId,
      replayId: dataset.id,
      sourceMode: "REPLAY",
      home: dataset.fixture.participants[0],
      away: dataset.fixture.participants[1],
      segment: "replay",
      homeScore: isActive && runtime.latestScores ? runtime.latestScores.stats[1] : undefined,
      awayScore: isActive && runtime.latestScores ? runtime.latestScores.stats[2] : undefined,
      matchMinute: isActive ? runtime.latestScores?.matchMinute : undefined,
      group: dataset.competition,
      isInPlay: isActive,
      replayStatus: isActive ? active.status : "AVAILABLE",
      replayTitle: dataset.title,
      availabilityReason: dataset.description,
    };
  });
  const history = completed.flatMap((fixture): DashboardFixture[] => {
    const fixtureId = Number(fixture.fixtureId);
    if (!Number.isSafeInteger(fixtureId)) return [];
    const dataset = fixture.replayId ? datasetsById.get(fixture.replayId) : undefined;
    const endedTimeMs = Date.parse(fixture.updatedAt);
    return [{
      id: fixtureId,
      replayId: fixture.replayId ?? undefined,
      sourceMode: "REPLAY",
      home: fixture.participants[0],
      away: fixture.participants[1],
      segment: "finished",
      homeScore: dataset?.fixture.finalScore[0],
      awayScore: dataset?.fixture.finalScore[1],
      group: dataset?.competition ?? "Historical replay",
      endedTimeMs: Number.isFinite(endedTimeMs) ? endedTimeMs : undefined,
      isInPlay: false,
      replayStatus: "FINISHED",
      replayTitle: dataset ? `${dataset.title} · Completed run` : "Completed replay run",
      availabilityReason: "This replay run finished. Select it to start a new run.",
    }];
  });
  return [...catalog, ...history];
}
