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
  P1_YELLOW: 3,
  P2_YELLOW: 4,
  P1_RED: 5,
  P2_RED: 6,
  P1_CORNERS: 7,
  P2_CORNERS: 8,
} as const;

export const GAME_PHASE_LABEL: Record<number, string> = {
  [GAME_PHASE.NS]: "Not Started",
  [GAME_PHASE.H1]: "First Half",
  [GAME_PHASE.HT]: "Halftime",
  [GAME_PHASE.H2]: "Second Half",
  [GAME_PHASE.F]: "Full Time",
};

export type MatchEventType =
  | "goal"
  | "yellow_card"
  | "red_card"
  | "corner"
  | "foul";

export interface MatchEvent {
  type: MatchEventType;
  teamIndex: 0 | 1;
  player?: string;
}

export interface TxLineScoresUpdate {
  fixtureId: number;
  seq: number;
  ts: number;
  gameState: number;
  matchMinute: number;
  participants: [string, string];
  stats: Record<number, number>;
  event?: MatchEvent;
}

export interface TxLineOddsMarket {
  marketId: string;
  selections: { name: string; price: number }[];
}

export interface TxLineOddsUpdate {
  fixtureId: number;
  seq: number;
  ts: number;
  markets: TxLineOddsMarket[];
}

export type TxLineStreamMessage =
  | { type: "scores"; data: TxLineScoresUpdate }
  | { type: "odds"; data: TxLineOddsUpdate };

export interface MockTxLineSnapshot {
  scores: TxLineScoresUpdate;
  odds: TxLineOddsUpdate;
}
