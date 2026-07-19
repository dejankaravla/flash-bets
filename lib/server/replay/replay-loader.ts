import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { MatchPhase } from "@/lib/domain/flash-bets";
import type { ReplayDataset, ReplaySummary, ReplayTimelineEntry } from "@/lib/replay/types";
import type { MatchEvent, TxLineScoresUpdate } from "@/lib/types/txline";

const REPLAY_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0;
}

function isSafeIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isSafeInteger);
}

function isStringPair(value: unknown): value is [string, string] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "string");
}

function isNonNegativeIntegerPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(isNonNegativeSafeInteger);
}

function isMatchPhase(value: unknown): value is MatchPhase {
  return value === "NOT_STARTED" ||
    value === "FIRST_HALF" ||
    value === "HALFTIME" ||
    value === "SECOND_HALF" ||
    value === "FINISHED" ||
    value === "SUSPENDED" ||
    value === "POSTPONED" ||
    value === "ABANDONED" ||
    value === "UNKNOWN";
}

function isStats(value: unknown): value is Record<number, number> {
  return isRecord(value) && Object.values(value).every((stat) => isFiniteNumber(stat) && stat >= 0);
}

function isMatchEvent(value: unknown): value is MatchEvent {
  if (!isRecord(value)) return false;
  return (value.type === "goal" || value.type === "corner") &&
    (value.teamIndex === 0 || value.teamIndex === 1);
}

function readScoresUpdate(value: unknown, fileName: string): TxLineScoresUpdate {
  if (!isRecord(value)) throw new Error(`Replay dataset ${fileName} contains an invalid score update`);
  const event = value.event;
  if (
    !isSafeInteger(value.fixtureId) ||
    !isSafeInteger(value.seq) ||
    !isFiniteNumber(value.ts) ||
    !isSafeInteger(value.gameState) ||
    !isMatchPhase(value.matchPhase) ||
    !(typeof value.sourceState === "string" || value.sourceState === null) ||
    typeof value.sourceTimestampTrusted !== "boolean" ||
    !isSafeInteger(value.matchMinute) ||
    !isStringPair(value.participants) ||
    !isStats(value.stats) ||
    !isSafeIntegerArray(value.availableStats) ||
    typeof value.isComplete !== "boolean" ||
    (event !== undefined && !isMatchEvent(event))
  ) {
    throw new Error(`Replay dataset ${fileName} contains an invalid score update`);
  }
  return {
    fixtureId: value.fixtureId,
    seq: value.seq,
    ts: value.ts,
    gameState: value.gameState,
    matchPhase: value.matchPhase,
    sourceState: value.sourceState,
    sourceTimestampTrusted: value.sourceTimestampTrusted,
    matchMinute: value.matchMinute,
    participants: value.participants,
    stats: value.stats,
    availableStats: value.availableStats,
    isComplete: value.isComplete,
    event,
  };
}

function replayDirectory(): string {
  return path.join(process.cwd(), "replays");
}

function assertDataset(value: unknown, fileName: string): ReplayDataset {
  if (!isRecord(value) || !isRecord(value.fixture)) {
    throw new Error(`Replay dataset ${fileName} is invalid`);
  }
  const fixture = value.fixture;
  if (
    value.version !== 1 ||
    typeof value.id !== "string" ||
    !REPLAY_ID.test(value.id) ||
    typeof value.title !== "string" ||
    typeof value.competition !== "string" ||
    typeof value.description !== "string" ||
    !isSafeInteger(fixture.fixtureId) ||
    !isStringPair(fixture.participants) ||
    !isNonNegativeIntegerPair(fixture.finalScore) ||
    !isSafeInteger(value.durationMs) ||
    value.durationMs <= 0 ||
    !isSafeInteger(value.frameIntervalMs) ||
    value.frameIntervalMs <= 0 ||
    !Array.isArray(value.timeline) ||
    value.timeline.length === 0
  ) {
    throw new Error(`Replay dataset ${fileName} is invalid`);
  }
  const durationMs = value.durationMs;
  const timeline: ReplayTimelineEntry[] = [];
  let previous = -1;
  for (const entry of value.timeline) {
    if (
      !isRecord(entry) ||
      !isSafeInteger(entry.atMs) ||
      entry.atMs < 0 ||
      entry.atMs > durationMs ||
      entry.atMs <= previous ||
      entry.update === undefined
    ) {
      throw new Error(`Replay dataset ${fileName} has an invalid or unordered timeline`);
    }
    previous = entry.atMs;
    timeline.push({ atMs: entry.atMs, update: readScoresUpdate(entry.update, fileName) });
  }
  if (timeline[0]?.atMs !== 0) {
    throw new Error(`Replay dataset ${fileName} must start at 0ms`);
  }
  return {
    version: 1,
    id: value.id,
    title: value.title,
    competition: value.competition,
    description: value.description,
    fixture: {
      fixtureId: fixture.fixtureId,
      participants: fixture.participants,
      finalScore: fixture.finalScore,
    },
    durationMs,
    frameIntervalMs: value.frameIntervalMs,
    timeline,
  };
}

async function readDatasetFile(fileName: string): Promise<ReplayDataset> {
  const raw = await readFile(path.join(replayDirectory(), fileName), "utf8");
  const parsed: unknown = JSON.parse(raw);
  return assertDataset(parsed, fileName);
}

export async function loadReplayDataset(replayId: string): Promise<ReplayDataset> {
  if (!REPLAY_ID.test(replayId)) throw new Error("Invalid replay identifier");
  return readDatasetFile(`${replayId}.json`);
}

export async function listReplayDatasets(): Promise<ReplayDataset[]> {
  const files = (await readdir(replayDirectory()))
    .filter((name) => name.endsWith(".json"))
    .sort();
  return Promise.all(files.map(readDatasetFile));
}

export async function listReplaySummaries(): Promise<ReplaySummary[]> {
  return (await listReplayDatasets()).map((dataset) => ({
    id: dataset.id,
    title: dataset.title,
    competition: dataset.competition,
    description: dataset.description,
    participants: dataset.fixture.participants,
    finalScore: dataset.fixture.finalScore,
    durationMs: dataset.durationMs,
  }));
}
