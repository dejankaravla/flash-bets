import type { MatchPhase } from "@/lib/domain/flash-bets";
import type { ReplayState } from "@/lib/replay/types";

export const GAME_PHASE = {
  NS: 1,
  H1: 2,
  HT: 3,
  H2: 4,
  F: 5,
} as const;

export const STAT_KEY = {
  P1_GOALS: 1,
  P2_GOALS: 2,
  P1_CORNERS: 7,
  P2_CORNERS: 8,
} as const;

export interface MatchEvent {
  type: "goal" | "corner";
  teamIndex: 0 | 1;
}

export interface TxLineScoresUpdate {
  fixtureId: number;
  seq: number;
  ts: number;
  gameState: number;
  matchPhase: MatchPhase;
  sourceState: string | null;
  sourceTimestampTrusted: boolean;
  matchMinute: number;
  participants: [string, string];
  stats: Record<number, number>;
  availableStats: number[];
  isComplete: boolean;
  event?: MatchEvent;
}

export type TxLineStreamMessage =
  | { type: "scores"; data: TxLineScoresUpdate }
  | { type: "replay-state"; data: ReplayState };
