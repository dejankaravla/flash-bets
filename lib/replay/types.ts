import type { TxLineScoresUpdate } from "@/lib/types/txline";

export const REPLAY_SPEEDS = [0.5, 1, 2, 5, 10] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
export type ReplayStatus = "PAUSED" | "PLAYING" | "FINISHED";

export interface ReplayTimelineEntry {
  atMs: number;
  update: TxLineScoresUpdate;
}

export interface ReplayDataset {
  version: 1;
  id: string;
  title: string;
  competition: string;
  description: string;
  fixture: {
    fixtureId: number;
    participants: [string, string];
    finalScore: [number, number];
  };
  durationMs: number;
  frameIntervalMs: number;
  timeline: ReplayTimelineEntry[];
}

export interface ReplaySummary {
  id: string;
  title: string;
  competition: string;
  description: string;
  participants: [string, string];
  finalScore: [number, number];
  durationMs: number;
}

export interface ReplayState {
  mode: "REPLAY";
  replayId: string;
  runId: string;
  fixtureId: number;
  title: string;
  competition: string;
  participants: [string, string];
  finalScore: [number, number];
  status: ReplayStatus;
  speed: ReplaySpeed;
  currentTimeMs: number;
  durationMs: number;
  virtualNowMs: number;
  progress: number;
}

