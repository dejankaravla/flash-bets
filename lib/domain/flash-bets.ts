export type SupportedMarketType = "GOAL" | "CORNER";
export type FixtureSourceMode = "LIVE" | "REPLAY";

export type MatchPhase =
  | "NOT_STARTED"
  | "FIRST_HALF"
  | "HALFTIME"
  | "SECOND_HALF"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "ABANDONED"
  | "UNKNOWN";

export type MarketPeriod = "FIRST_HALF" | "SECOND_HALF";
export type MarketStatus =
  | "CREATED"
  | "OPEN"
  | "LOCKED"
  | "WAITING_FOR_SETTLEMENT"
  | "SETTLED"
  | "VOID";
export type PredictionSelection = "YES" | "NO";
export type PredictionStatus =
  | "PENDING"
  | "LOCKED"
  | "WON"
  | "LOST"
  | "REFUNDED"
  | "VOID";
export type MarketResult = PredictionSelection | "VOID";

export interface TxLineSnapshot {
  goals: number;
  corners: number;
  sequence: number;
  matchSecond: number;
  phase: MatchPhase;
  sourceTimestamp: string;
  receivedAt: string;
  capturedAt: string;
}

export interface Fixture {
  fixtureId: string;
  participants: [string, string];
  phase: MatchPhase;
  matchMinute: number;
  matchSecond: number;
  goals: number | null;
  corners: number | null;
  sequence: number;
  sourceTimestamp: string;
  sourceTimestampTrusted: boolean;
  receivedAt: string;
  source: string;
  sourceMode?: FixtureSourceMode;
  replayId?: string | null;
  replayRunId?: string | null;
  complete: boolean;
  updatedAt: string;
}

export interface Market {
  marketId: string;
  fixtureId: string;
  type: SupportedMarketType;
  period: MarketPeriod;
  startMinute: number;
  endMinute: number;
  opensAt: string;
  locksAt: string;
  startsAt: string;
  endsAt: string;
  settlesAt: string;
  settlementDelaySeconds: number;
  status: MarketStatus;
  openingSnapshot: TxLineSnapshot | null;
  closingSnapshot: TxLineSnapshot | null;
  result: MarketResult | null;
  settlementReceiptId: string | null;
  question: string;
  source: string;
  sourceMode?: FixtureSourceMode;
  replayId?: string | null;
  replayRunId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Prediction {
  predictionId: string;
  marketId: string;
  wallet: string;
  side: PredictionSelection;
  amount: number;
  status: PredictionStatus;
  settlementReceiptId: string | null;
  reward: number;
  refund: number;
  createdAt: string;
  updatedAt: string;
  settledAt: string | null;
}

export interface PredictionView extends Prediction {
  market: Market | null;
  fixture: Fixture | null;
  receipt: SettlementReceipt | null;
}

export interface FlashPointsAccount {
  wallet: string;
  available: number;
  locked: number;
  won: number;
  lost: number;
  refunded: number;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementAward {
  predictionId: string;
  wallet: string;
  side: PredictionSelection;
  amount: number;
  reward: number;
  refund: number;
  status: Extract<PredictionStatus, "WON" | "LOST" | "VOID">;
}

export interface SettlementReceipt {
  receiptId: string;
  marketId: string;
  fixtureId: string;
  settlementReason: string;
  txLineOpeningTimestamp: string | null;
  txLineClosingTimestamp: string | null;
  openingSnapshot: TxLineSnapshot | null;
  closingSnapshot: TxLineSnapshot | null;
  calculatedDelta: number | null;
  winningSide: PredictionSelection | null;
  correctionDelaySeconds: number;
  settlementVersion: number;
  totalPool: number;
  winningPool: number;
  remainder: number;
  awards: SettlementAward[];
  createdAt: string;
}

export interface WalletChallenge {
  challengeId: string;
  wallet: string;
  message: string;
  nonce: string;
  origin: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface WalletSession {
  tokenHash: string;
  wallet: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

/** Prompt 1 JSON shape, retained only as the migration input contract. */
export interface LegacyFlashBetsState {
  version: 2;
  fixtures: Record<string, Record<string, unknown>>;
  markets: Record<string, Record<string, unknown>>;
  predictions: Record<string, Record<string, unknown>>;
  flashPointsAccounts: Record<string, FlashPointsAccount>;
  settlementReceipts: Record<string, Record<string, unknown>>;
  authChallenges: Record<string, Record<string, unknown>>;
  sessions: Record<string, Record<string, unknown>>;
}

export interface AuthenticatedUserView {
  wallet: string;
  flashPoints: FlashPointsAccount;
  sessionExpiresAt: string;
}

export function marketQuestion(type: SupportedMarketType): string {
  return type === "GOAL"
    ? "Will there be at least one goal in this window?"
    : "Will there be at least one corner in this window?";
}
