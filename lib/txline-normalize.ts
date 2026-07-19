import {
  GAME_PHASE,
  STAT_KEY,
  type MatchEvent,
  type TxLineScoresUpdate,
} from "@/lib/types/txline";
import type { MatchPhase } from "@/lib/domain/flash-bets";

/** Raw TxLINE scores SSE payload (camelCase + PascalCase fields). */
export interface RawTxLineScores {
  fixtureId?: number;
  FixtureId?: number;
  seq?: number;
  Seq?: number;
  ts?: number;
  Ts?: number;
  gameState?: string;
  GameState?: string;
  statusSoccerId?: unknown;
  participant1?: string;
  Participant1?: string;
  participant2?: string;
  Participant2?: string;
  participant1IsHome?: boolean;
  Participant1IsHome?: boolean;
  action?: string;
  Action?: string;
  stats?: Record<string, number>;
  Stats?: Record<string, number>;
  scoreSoccer?: RawSoccerScore;
  ScoreSoccer?: RawSoccerScore;
  dataSoccer?: RawSoccerData;
  DataSoccer?: RawSoccerData;
}

interface RawSoccerScore {
  Participant1?: { Total?: { Goals?: number } };
  Participant2?: { Total?: { Goals?: number } };
}

interface RawSoccerData {
  Minutes?: number;
  minutes?: number;
  Goal?: boolean;
  goal?: boolean;
  YellowCard?: boolean;
  yellowCard?: boolean;
  RedCard?: boolean;
  redCard?: boolean;
  Corner?: boolean;
  corner?: boolean;
  Participant?: number;
  participant?: number;
  PlayerId?: number;
  playerId?: number;
}

const GAME_STATE_MAP: Record<string, number> = {
  NS: GAME_PHASE.NS,
  H1: GAME_PHASE.H1,
  HT: GAME_PHASE.HT,
  H2: GAME_PHASE.H2,
  F: GAME_PHASE.F,
  FT: GAME_PHASE.F,
  FET: GAME_PHASE.F,
  FPE: GAME_PHASE.F,
  AET: GAME_PHASE.F,
};

const MATCH_PHASE_MAP: Record<string, MatchPhase> = {
  NS: "NOT_STARTED",
  NOT_STARTED: "NOT_STARTED",
  SCHEDULED: "NOT_STARTED",
  PREMATCH: "NOT_STARTED",
  H1: "FIRST_HALF",
  FIRST_HALF: "FIRST_HALF",
  HT: "HALFTIME",
  HALFTIME: "HALFTIME",
  H2: "SECOND_HALF",
  SECOND_HALF: "SECOND_HALF",
  F: "FINISHED",
  FT: "FINISHED",
  FET: "FINISHED",
  FPE: "FINISHED",
  AET: "FINISHED",
  FINISHED: "FINISHED",
  SUSPENDED: "SUSPENDED",
  PAUSED: "SUSPENDED",
  INTERRUPTED: "SUSPENDED",
  DELAYED: "SUSPENDED",
  POSTPONED: "POSTPONED",
  ABANDONED: "ABANDONED",
  CANCELLED: "ABANDONED",
};

function readSourceState(raw: RawTxLineScores): string | null {
  const explicit = raw.gameState ?? raw.GameState;
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim().toUpperCase();
  }

  const status = raw.statusSoccerId;
  if (status && typeof status === "object" && !Array.isArray(status)) {
    const key = Object.keys(status)[0];
    if (key) return key.trim().toUpperCase();
  }
  if (typeof status === "string" && status.trim()) {
    return status.trim().toUpperCase();
  }
  return null;
}

function parseMatchPhase(raw: RawTxLineScores): MatchPhase {
  const state = readSourceState(raw);
  return state ? (MATCH_PHASE_MAP[state] ?? "UNKNOWN") : "UNKNOWN";
}

function readFixtureId(raw: RawTxLineScores): number | null {
  const id = raw.fixtureId ?? raw.FixtureId;
  return typeof id === "number" ? id : null;
}

function parseGameState(raw: RawTxLineScores): number {
  const state = readSourceState(raw);
  if (state && GAME_STATE_MAP[state] !== undefined) return GAME_STATE_MAP[state]!;
  const phase = parseMatchPhase(raw);
  if (phase === "FIRST_HALF") return GAME_PHASE.H1;
  if (phase === "HALFTIME") return GAME_PHASE.HT;
  if (phase === "SECOND_HALF") return GAME_PHASE.H2;
  if (phase === "FINISHED") return GAME_PHASE.F;
  return GAME_PHASE.NS;
}

function parseMatchMinute(raw: RawTxLineScores): number {
  const soccer = raw.dataSoccer ?? raw.DataSoccer;
  const minutes = soccer?.Minutes ?? soccer?.minutes;
  if (typeof minutes === "number" && minutes >= 0) {
    return minutes;
  }
  return 0;
}

function buildStats(
  raw: RawTxLineScores,
  participants: [string, string],
): Record<number, number> {
  const rawStats = raw.stats ?? raw.Stats ?? {};
  const stats: Record<number, number> = {};

  for (const [key, value] of Object.entries(rawStats)) {
    const numKey = Number(key);
    if (!Number.isNaN(numKey) && typeof value === "number") {
      stats[numKey] = value;
    }
  }

  const scoreSoccer = raw.scoreSoccer ?? raw.ScoreSoccer;
  const p1Goals = scoreSoccer?.Participant1?.Total?.Goals;
  const p2Goals = scoreSoccer?.Participant2?.Total?.Goals;

  if (typeof p1Goals === "number") {
    stats[STAT_KEY.P1_GOALS] = p1Goals;
  }
  if (typeof p2Goals === "number") {
    stats[STAT_KEY.P2_GOALS] = p2Goals;
  }

  void participants;
  return stats;
}

function parseEvent(raw: RawTxLineScores): MatchEvent | undefined {
  const soccer = raw.dataSoccer ?? raw.DataSoccer;
  if (!soccer) return undefined;

  let type: MatchEvent["type"] | null = null;
  if (soccer.Goal || soccer.goal) type = "goal";
  else if (soccer.Corner || soccer.corner) type = "corner";

  if (!type) return undefined;

  const participant = soccer.Participant ?? soccer.participant;
  const teamIndex: 0 | 1 = participant === 2 ? 1 : 0;

  return { type, teamIndex };
}

export function normalizeScoresUpdate(
  raw: RawTxLineScores,
  participants: [string, string],
): TxLineScoresUpdate | null {
  const fixtureId = readFixtureId(raw);
  if (fixtureId === null) return null;

  const seq = raw.seq ?? raw.Seq ?? 0;
  const rawTimestamp = raw.ts ?? raw.Ts;
  const ts = rawTimestamp ?? Date.now();
  const stats = buildStats(raw, participants);
  const availableStats = Object.keys(stats)
    .map(Number)
    .filter((key) => Number.isFinite(key));
  const matchPhase = parseMatchPhase(raw);
  const requiredStats = [
    STAT_KEY.P1_GOALS,
    STAT_KEY.P2_GOALS,
    STAT_KEY.P1_CORNERS,
    STAT_KEY.P2_CORNERS,
  ];

  return {
    fixtureId,
    seq,
    ts,
    gameState: parseGameState(raw),
    matchPhase,
    sourceState: readSourceState(raw),
    sourceTimestampTrusted: typeof rawTimestamp === "number",
    matchMinute: parseMatchMinute(raw),
    participants,
    stats,
    availableStats,
    isComplete:
      matchPhase !== "UNKNOWN" &&
      requiredStats.every((key) => availableStats.includes(key)),
    event: parseEvent(raw),
  };
}
