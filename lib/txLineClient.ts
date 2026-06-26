import {
  getTxLineApiUrl,
  hasTxLineCredentials,
  txLineHeaders,
} from "@/lib/txline-auth";
import {
  mergeOddsUpdate,
  normalizeOddsLine,
  normalizeScoresUpdate,
  type RawTxLineOdds,
  type RawTxLineScores,
} from "@/lib/txline-normalize";
import type {
  MockTxLineSnapshot,
  TxLineStreamMessage,
} from "@/lib/types/txline";

const RECONNECT_DELAY_MS = 5_000;

type StreamChannel = "scores" | "odds";
type Listener = (msg: TxLineStreamMessage) => void;

interface TxLineFixtureMeta {
  participants: [string, string];
}

export interface TxLineClient {
  subscribe(
    fixtureId: string,
    listener: (msg: TxLineStreamMessage) => void,
  ): () => void;
}

function parseSseChunk(
  chunk: string,
): { event?: string; data?: string } | null {
  const trimmed = chunk.trim();
  if (!trimmed || trimmed.startsWith(":")) return null;

  let event: string | undefined;
  let data: string | undefined;

  for (const line of trimmed.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data = line.slice(5).trim();
    }
  }

  if (!data) return null;
  return { event, data };
}

function getParticipantsForFixture(
  fixtureId: string,
  meta: Record<string, TxLineFixtureMeta>,
): [string, string] {
  return meta[fixtureId]?.participants ?? ["Home", "Away"];
}

function totalListenerCount(listeners: Map<string, Set<Listener>>): number {
  let count = 0;
  for (const set of listeners.values()) {
    count += set.size;
  }
  return count;
}

function createTxLineClient(): TxLineClient {
  const snapshots: Record<string, MockTxLineSnapshot> = {};
  const listeners = new Map<string, Set<Listener>>();
  const fixtureMeta: Record<string, TxLineFixtureMeta> = {};

  const abortControllers: Record<StreamChannel, AbortController | null> = {
    scores: null,
    odds: null,
  };
  const reconnectTimers: Record<StreamChannel, ReturnType<typeof setTimeout> | null> =
    {
      scores: null,
      odds: null,
    };
  const reconnectScheduled: Record<StreamChannel, boolean> = {
    scores: false,
    odds: false,
  };

  let metaLoaded = false;
  let upstreamActive = false;

  function broadcast(fixtureId: string, msg: TxLineStreamMessage): void {
    const set = listeners.get(fixtureId);
    if (!set) return;
    for (const listener of set) {
      listener(msg);
    }
  }

  function emitCached(fixtureId: string, listener: Listener): void {
    const cached = snapshots[fixtureId];
    if (!cached) return;
    listener({ type: "scores", data: cached.scores });
    listener({ type: "odds", data: cached.odds });
  }

  function handleScoresPayload(raw: RawTxLineScores): void {
    const fixtureId = String(raw.fixtureId ?? raw.FixtureId ?? "");
    if (!fixtureId) return;

    const participants = getParticipantsForFixture(fixtureId, fixtureMeta);
    const scores = normalizeScoresUpdate(raw, participants);
    if (!scores) return;

    const existing = snapshots[fixtureId];
    snapshots[fixtureId] = {
      scores,
      odds: existing?.odds ?? {
        fixtureId: scores.fixtureId,
        seq: 0,
        ts: scores.ts,
        markets: [],
      },
    };

    broadcast(fixtureId, { type: "scores", data: scores });
  }

  function handleOddsPayload(raw: RawTxLineOdds): void {
    const line = normalizeOddsLine(raw);
    if (!line) return;

    const fixtureId = String(line.fixtureId);
    const existing = snapshots[fixtureId];
    const odds = mergeOddsUpdate(existing?.odds, line);

    snapshots[fixtureId] = {
      scores: existing?.scores ?? {
        fixtureId: line.fixtureId,
        seq: 0,
        ts: line.ts,
        gameState: 1,
        matchMinute: 0,
        participants: getParticipantsForFixture(fixtureId, fixtureMeta),
        stats: { 1: 0, 2: 0 },
      },
      odds,
    };

    broadcast(fixtureId, { type: "odds", data: odds });
  }

  async function consumeSseStream(
    channel: StreamChannel,
    path: string,
    onData: (payload: unknown) => void,
  ): Promise<void> {
    const controller = new AbortController();
    abortControllers[channel] = controller;

    let response: Response;
    try {
      response = await fetch(`${getTxLineApiUrl()}${path}`, {
        headers: txLineHeaders(),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      scheduleReconnect(channel);
      console.error(`[txLineClient] ${channel} connect failed`, error);
      return;
    }

    if (!response.ok) {
      if (controller.signal.aborted) return;
      if (response.status === 429 || response.status >= 500) {
        scheduleReconnect(channel);
      } else {
        console.error(
          `[txLineClient] ${channel} HTTP ${response.status}`,
          await response.text().catch(() => ""),
        );
        scheduleReconnect(channel);
      }
      return;
    }

    if (!response.body) {
      scheduleReconnect(channel);
      return;
    }

    reconnectScheduled[channel] = false;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const parsed = parseSseChunk(part);
          if (!parsed) continue;
          if (parsed.event === "heartbeat") continue;

          try {
            onData(JSON.parse(parsed.data!));
          } catch {
            // Skip malformed payloads
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(`[txLineClient] ${channel} stream error`, error);
      }
    } finally {
      reader.releaseLock();
    }

    if (!controller.signal.aborted && upstreamActive) {
      scheduleReconnect(channel);
    }
  }

  function scheduleReconnect(channel: StreamChannel): void {
    if (!upstreamActive || reconnectScheduled[channel]) return;
    reconnectScheduled[channel] = true;

    abortControllers[channel]?.abort();
    abortControllers[channel] = null;

    reconnectTimers[channel] = setTimeout(() => {
      reconnectTimers[channel] = null;
      reconnectScheduled[channel] = false;
      if (upstreamActive && totalListenerCount(listeners) > 0) {
        void startChannel(channel);
      }
    }, RECONNECT_DELAY_MS);
  }

  function startChannel(channel: StreamChannel): void {
    if (channel === "scores") {
      void consumeSseStream(channel, "/api/scores/stream", (payload) => {
        handleScoresPayload(payload as RawTxLineScores);
      });
      return;
    }

    void consumeSseStream(channel, "/api/odds/stream", (payload) => {
      handleOddsPayload(payload as RawTxLineOdds);
    });
  }

  async function loadFixtureMeta(): Promise<void> {
    if (metaLoaded || !hasTxLineCredentials()) return;

    try {
      const url = new URL(`${getTxLineApiUrl()}/api/fixtures/snapshot`);
      const competitionId = process.env.TXLINE_COMPETITION_ID?.trim();
      if (competitionId) {
        url.searchParams.set("competitionId", competitionId);
      }

      const response = await fetch(url, {
        headers: txLineHeaders(),
        cache: "no-store",
      });

      if (!response.ok) return;

      const fixtures = (await response.json()) as Array<{
        FixtureId?: number;
        fixtureId?: number;
        Participant1?: string;
        Participant2?: string;
        participant1?: string;
        participant2?: string;
        Participant1IsHome?: boolean;
        participant1IsHome?: boolean;
      }>;

      for (const fixture of fixtures) {
        const id = fixture.FixtureId ?? fixture.fixtureId;
        if (id === undefined) continue;

        const p1 = fixture.Participant1 ?? fixture.participant1 ?? "Home";
        const p2 = fixture.Participant2 ?? fixture.participant2 ?? "Away";
        const p1Home = fixture.Participant1IsHome ?? fixture.participant1IsHome ?? true;

        fixtureMeta[String(id)] = {
          participants: p1Home ? [p1, p2] : [p2, p1],
        };
      }

      metaLoaded = true;
    } catch (error) {
      console.error("[txLineClient] fixture meta load failed", error);
    }
  }

  function startUpstream(): void {
    if (upstreamActive) return;
    upstreamActive = true;
    void loadFixtureMeta().finally(() => {
      startChannel("scores");
      startChannel("odds");
    });
  }

  function stopUpstream(): void {
    upstreamActive = false;

    for (const channel of ["scores", "odds"] as const) {
      reconnectScheduled[channel] = false;
      if (reconnectTimers[channel]) {
        clearTimeout(reconnectTimers[channel]!);
        reconnectTimers[channel] = null;
      }
      abortControllers[channel]?.abort();
      abortControllers[channel] = null;
    }
  }

  return {
    subscribe(fixtureId, listener) {
      let set = listeners.get(fixtureId);
      if (!set) {
        set = new Set();
        listeners.set(fixtureId, set);
      }

      const isFirstGlobal = totalListenerCount(listeners) === 0;
      set.add(listener);
      emitCached(fixtureId, listener);

      if (isFirstGlobal) {
        startUpstream();
      }

      return () => {
        const current = listeners.get(fixtureId);
        if (!current) return;

        current.delete(listener);
        if (current.size === 0) {
          listeners.delete(fixtureId);
        }

        if (totalListenerCount(listeners) === 0) {
          stopUpstream();
        }
      };
    },
  };
}

export const txLineClient: TxLineClient = createTxLineClient();
