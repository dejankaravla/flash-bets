import {
  getTxLineApiUrl,
  hasTxLineCredentials,
  txLineHeaders,
} from "@/lib/txline-auth";
import {
  normalizeScoresUpdate,
  type RawTxLineScores,
} from "@/lib/txline-normalize";
import type {
  TxLineScoresUpdate,
  TxLineStreamMessage,
} from "@/lib/types/txline";
import { ingestTxLineScores } from "@/lib/server/market-service";

const RECONNECT_DELAY_MS = 5_000;
type Listener = (message: TxLineStreamMessage) => void;

export interface TxLineClient {
  subscribe(fixtureId: string, listener: Listener): () => void;
}

function parseSseChunk(chunk: string): { event?: string; data?: string } | null {
  const trimmed = chunk.trim();
  if (!trimmed || trimmed.startsWith(":")) return null;
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of trimmed.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  return dataLines.length > 0 ? { event, data: dataLines.join("\n") } : null;
}

function listenerCount(listeners: Map<string, Set<Listener>>): number {
  let count = 0;
  for (const set of listeners.values()) count += set.size;
  return count;
}

function createTxLineClient(): TxLineClient {
  const snapshots: Record<string, TxLineScoresUpdate> = {};
  const listeners = new Map<string, Set<Listener>>();
  const fixtureParticipants: Record<string, [string, string]> = {};
  let upstreamActive = false;
  let reconnectScheduled = false;
  let abortController: AbortController | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let metaPromise: Promise<void> | null = null;

  function broadcast(fixtureId: string, scores: TxLineScoresUpdate): void {
    for (const listener of listeners.get(fixtureId) ?? []) {
      listener({ type: "scores", data: scores });
    }
  }

  function participants(fixtureId: string): [string, string] {
    return fixtureParticipants[fixtureId] ?? ["Home", "Away"];
  }

  function handleScores(raw: RawTxLineScores): void {
    const fixtureId = String(raw.fixtureId ?? raw.FixtureId ?? "");
    if (!fixtureId) return;
    const scores = normalizeScoresUpdate(raw, participants(fixtureId));
    if (!scores) return;
    const previous = snapshots[fixtureId];
    const exactDuplicate =
      previous &&
      scores.seq === previous.seq &&
      scores.ts === previous.ts &&
      scores.matchPhase === previous.matchPhase &&
      scores.matchMinute === previous.matchMinute &&
      JSON.stringify(scores.stats) === JSON.stringify(previous.stats);
    if (
      previous &&
      (scores.seq < previous.seq ||
        (scores.seq === previous.seq && scores.ts < previous.ts) ||
        exactDuplicate)
    ) {
      return;
    }
    snapshots[fixtureId] = scores;
    void ingestTxLineScores(scores)
      .then(() => broadcast(fixtureId, scores))
      .catch(() => console.error("[txLineClient] failed to persist scores"));
  }

  function scheduleReconnect(): void {
    if (!upstreamActive || reconnectScheduled) return;
    reconnectScheduled = true;
    abortController?.abort();
    abortController = null;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectScheduled = false;
      if (upstreamActive && listenerCount(listeners) > 0) void consumeScoresStream();
    }, RECONNECT_DELAY_MS);
  }

  async function consumeScoresStream(): Promise<void> {
    const controller = new AbortController();
    abortController = controller;
    try {
      const response = await fetch(`${getTxLineApiUrl()}/api/scores/stream`, {
        headers: txLineHeaders(),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok || !response.body) {
        if (!controller.signal.aborted) scheduleReconnect();
        return;
      }
      reconnectScheduled = false;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const parsed = parseSseChunk(chunk);
            if (!parsed?.data || parsed.event === "heartbeat") continue;
            try {
              handleScores(JSON.parse(parsed.data) as RawTxLineScores);
            } catch {
              // Ignore malformed upstream messages without discarding the stream.
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch {
      if (!controller.signal.aborted) {
        console.error("[txLineClient] scores stream error");
      }
    }
    if (!controller.signal.aborted && upstreamActive) scheduleReconnect();
  }

  async function loadFixtureMeta(): Promise<void> {
    if (metaPromise) return metaPromise;
    metaPromise = (async () => {
      const url = new URL(`${getTxLineApiUrl()}/api/fixtures/snapshot`);
      const competitionId = process.env.TXLINE_COMPETITION_ID?.trim();
      if (competitionId) url.searchParams.set("competitionId", competitionId);
      try {
        const response = await fetch(url, { headers: txLineHeaders(), cache: "no-store" });
        if (!response.ok) return;
        const rows = (await response.json()) as Array<Record<string, unknown>>;
        for (const row of rows) {
          const id = row.FixtureId ?? row.fixtureId;
          if (typeof id !== "number") continue;
          const p1 = typeof (row.Participant1 ?? row.participant1) === "string" ? String(row.Participant1 ?? row.participant1) : "Home";
          const p2 = typeof (row.Participant2 ?? row.participant2) === "string" ? String(row.Participant2 ?? row.participant2) : "Away";
          const p1Home = (row.Participant1IsHome ?? row.participant1IsHome) !== false;
          fixtureParticipants[String(id)] = p1Home ? [p1, p2] : [p2, p1];
        }
      } catch {
        console.error("[txLineClient] fixture metadata unavailable");
      }
    })();
    return metaPromise;
  }

  async function loadSnapshot(fixtureId: string): Promise<void> {
    try {
      const response = await fetch(`${getTxLineApiUrl()}/api/scores/snapshot/${fixtureId}`, {
        headers: txLineHeaders(),
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json();
      const latest = Array.isArray(payload) ? payload[payload.length - 1] : payload;
      if (latest && typeof latest === "object") handleScores(latest as RawTxLineScores);
    } catch {
      console.error("[txLineClient] score snapshot unavailable");
    }
  }

  function start(): void {
    if (upstreamActive || !hasTxLineCredentials()) return;
    upstreamActive = true;
    void loadFixtureMeta().finally(() => consumeScoresStream());
  }

  function stop(): void {
    upstreamActive = false;
    reconnectScheduled = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    abortController?.abort();
    abortController = null;
  }

  return {
    subscribe(fixtureId, listener) {
      let set = listeners.get(fixtureId);
      if (!set) {
        set = new Set();
        listeners.set(fixtureId, set);
      }
      const first = listenerCount(listeners) === 0;
      set.add(listener);
      const cached = snapshots[fixtureId];
      if (cached) listener({ type: "scores", data: cached });
      if (first) start();
      void loadFixtureMeta().then(() => loadSnapshot(fixtureId));

      return () => {
        const current = listeners.get(fixtureId);
        current?.delete(listener);
        if (current?.size === 0) listeners.delete(fixtureId);
        if (listenerCount(listeners) === 0) stop();
      };
    },
  };
}

export const txLineClient: TxLineClient = createTxLineClient();
