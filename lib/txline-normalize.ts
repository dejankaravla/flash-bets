import {
  GAME_PHASE,
  STAT_KEY,
  type MatchEvent,
  type MatchEventType,
  type TxLineOddsMarket,
  type TxLineOddsUpdate,
  type TxLineScoresUpdate,
} from "@/lib/types/txline";

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

/** Raw TxLINE odds SSE payload. */
export interface RawTxLineOdds {
  FixtureId?: number;
  fixtureId?: number;
  MessageId?: string;
  messageId?: string;
  Ts?: number;
  ts?: number;
  SuperOddsType?: string;
  superOddsType?: string;
  PriceNames?: string[];
  priceNames?: string[];
  Prices?: number[];
  prices?: number[];
  Seq?: number;
  seq?: number;
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

function readFixtureId(raw: RawTxLineScores | RawTxLineOdds): number | null {
  const id =
    ("fixtureId" in raw ? raw.fixtureId : undefined) ??
    ("FixtureId" in raw ? raw.FixtureId : undefined);
  return typeof id === "number" ? id : null;
}

function parseGameState(raw: RawTxLineScores): number {
  const explicit = raw.gameState ?? raw.GameState;
  if (explicit && GAME_STATE_MAP[explicit] !== undefined) {
    return GAME_STATE_MAP[explicit]!;
  }

  const status = raw.statusSoccerId;
  if (status && typeof status === "object" && !Array.isArray(status)) {
    const key = Object.keys(status)[0];
    if (key && GAME_STATE_MAP[key] !== undefined) {
      return GAME_STATE_MAP[key]!;
    }
  }

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

  if (stats[STAT_KEY.P1_GOALS] === undefined) stats[STAT_KEY.P1_GOALS] = 0;
  if (stats[STAT_KEY.P2_GOALS] === undefined) stats[STAT_KEY.P2_GOALS] = 0;

  void participants;
  return stats;
}

function parseEvent(raw: RawTxLineScores): MatchEvent | undefined {
  const soccer = raw.dataSoccer ?? raw.DataSoccer;
  if (!soccer) return undefined;

  let type: MatchEventType | null = null;
  if (soccer.Goal || soccer.goal) type = "goal";
  else if (soccer.YellowCard || soccer.yellowCard) type = "yellow_card";
  else if (soccer.RedCard || soccer.redCard) type = "red_card";
  else if (soccer.Corner || soccer.corner) type = "corner";

  if (!type) return undefined;

  const participant = soccer.Participant ?? soccer.participant;
  const teamIndex: 0 | 1 = participant === 2 ? 1 : 0;

  return { type, teamIndex };
}

function decodeOddsPrice(raw: number): number {
  if (raw <= 0) return 1.01;
  if (raw >= 100) return raw / 100;
  return raw;
}

export function normalizeScoresUpdate(
  raw: RawTxLineScores,
  participants: [string, string],
): TxLineScoresUpdate | null {
  const fixtureId = readFixtureId(raw);
  if (fixtureId === null) return null;

  const seq = raw.seq ?? raw.Seq ?? 0;
  const ts = raw.ts ?? raw.Ts ?? Date.now();

  return {
    fixtureId,
    seq,
    ts,
    gameState: parseGameState(raw),
    matchMinute: parseMatchMinute(raw),
    participants,
    stats: buildStats(raw, participants),
    event: parseEvent(raw),
  };
}

export function normalizeOddsLine(
  raw: RawTxLineOdds,
): { fixtureId: number; market: TxLineOddsMarket; seq: number; ts: number } | null {
  const fixtureId = readFixtureId(raw);
  if (fixtureId === null) return null;

  const marketId = raw.SuperOddsType ?? raw.superOddsType ?? "unknown";
  const names = raw.PriceNames ?? raw.priceNames ?? [];
  const prices = raw.Prices ?? raw.prices ?? [];

  const selections = names.map((name, index) => ({
    name,
    price: decodeOddsPrice(prices[index] ?? 0),
  }));

  if (selections.length === 0) return null;

  return {
    fixtureId,
    market: { marketId, selections },
    seq: raw.seq ?? raw.Seq ?? 0,
    ts: raw.ts ?? raw.Ts ?? Date.now(),
  };
}

export function mergeOddsUpdate(
  existing: TxLineOddsUpdate | undefined,
  line: { fixtureId: number; market: TxLineOddsMarket; seq: number; ts: number },
): TxLineOddsUpdate {
  const markets = [...(existing?.markets ?? [])];
  const index = markets.findIndex((m) => m.marketId === line.market.marketId);

  if (index >= 0) {
    markets[index] = line.market;
  } else {
    markets.push(line.market);
  }

  return {
    fixtureId: line.fixtureId,
    seq: Math.max(existing?.seq ?? 0, line.seq),
    ts: line.ts,
    markets,
  };
}

export function gameStateFromString(state: string | undefined): number {
  if (!state) return GAME_PHASE.NS;
  return GAME_STATE_MAP[state] ?? GAME_PHASE.NS;
}

export function isInPlayGameState(gameState: number): boolean {
  return (
    gameState === GAME_PHASE.H1 ||
    gameState === GAME_PHASE.HT ||
    gameState === GAME_PHASE.H2
  );
}

export function isFinishedGameState(gameState: number): boolean {
  return gameState === GAME_PHASE.F;
}
