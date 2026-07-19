import "server-only";

import type { ClientSession } from "mongoose";

import {
  marketQuestion,
  type Fixture,
  type FlashPointsAccount,
  type LegacyFlashBetsState,
  type Market,
  type MarketStatus,
  type Prediction,
  type SettlementReceipt,
  type TxLineSnapshot,
  type WalletChallenge,
  type WalletSession,
} from "@/lib/domain/flash-bets";
import { DEFAULT_SETTLEMENT_DELAY_SECONDS } from "@/lib/market-policy";
import {
  upsertChallengeForMigration,
  upsertSessionForMigration,
} from "@/lib/server/repositories/auth-repository";
import { upsertFixture } from "@/lib/server/repositories/fixture-repository";
import { upsertMarketForMigration } from "@/lib/server/repositories/market-repository";
import { upsertPredictionForMigration } from "@/lib/server/repositories/prediction-repository";
import { upsertReceiptForMigration } from "@/lib/server/repositories/receipt-repository";
import { runInTransaction } from "@/lib/server/repositories/transaction-repository";
import { upsertWalletAccountForMigration } from "@/lib/server/repositories/wallet-account-repository";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function integerValue(value: unknown, fallback = 0): number {
  return Number.isSafeInteger(value) ? (value as number) : fallback;
}

function nullableInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;
}

function boolValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1_000).toISOString();
}

function migrationDelaySeconds(): number {
  const parsed = Number(process.env.SETTLEMENT_DELAY_SECONDS);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_SETTLEMENT_DELAY_SECONDS;
}

function normalizeSnapshot(value: unknown): TxLineSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  const goals = nullableInteger(snapshot.goals);
  const corners = nullableInteger(snapshot.corners);
  if (goals === null || corners === null) return null;
  return {
    goals,
    corners,
    sequence: integerValue(snapshot.sequence),
    matchSecond: integerValue(snapshot.matchSecond),
    phase: stringValue(snapshot.phase, "UNKNOWN") as TxLineSnapshot["phase"],
    sourceTimestamp: stringValue(snapshot.sourceTimestamp),
    receivedAt: stringValue(snapshot.receivedAt),
    capturedAt: stringValue(snapshot.capturedAt, stringValue(snapshot.receivedAt)),
  };
}

function normalizeFixture(key: string, source: Record<string, unknown>): Fixture {
  const now = new Date().toISOString();
  const participants = Array.isArray(source.participants)
    ? source.participants.map(String).slice(0, 2)
    : ["Unknown", "Unknown"];
  while (participants.length < 2) participants.push("Unknown");
  return {
    fixtureId: stringValue(source.fixtureId, stringValue(source.id, key)),
    participants: [participants[0]!, participants[1]!],
    phase: stringValue(source.phase, "UNKNOWN") as Fixture["phase"],
    matchMinute: integerValue(source.matchMinute),
    matchSecond: integerValue(source.matchSecond),
    goals: nullableInteger(source.goals),
    corners: nullableInteger(source.corners),
    sequence: integerValue(source.sequence),
    sourceTimestamp: stringValue(source.sourceTimestamp, now),
    sourceTimestampTrusted: boolValue(source.sourceTimestampTrusted),
    receivedAt: stringValue(source.receivedAt, now),
    source: stringValue(source.source, "TxLINE"),
    complete: boolValue(source.complete),
    updatedAt: stringValue(source.updatedAt, stringValue(source.receivedAt, now)),
  };
}

function migrateMarketStatus(value: unknown): MarketStatus {
  if (
    value === "CREATED" ||
    value === "OPEN" ||
    value === "LOCKED" ||
    value === "WAITING_FOR_SETTLEMENT" ||
    value === "SETTLED" ||
    value === "VOID"
  ) {
    return value;
  }
  if (value === "SCHEDULED") return "CREATED";
  if (value === "ACTIVE" || value === "CLOSED") return "WAITING_FOR_SETTLEMENT";
  return "CREATED";
}

function normalizeMarket(key: string, source: Record<string, unknown>): Market {
  const delay = integerValue(source.settlementDelaySeconds, migrationDelaySeconds());
  const now = new Date().toISOString();
  const endsAt = stringValue(source.endsAt, now);
  const type = source.type === "CORNER" ? "CORNER" : "GOAL";
  return {
    marketId: stringValue(source.marketId, stringValue(source.id, key)),
    fixtureId: stringValue(source.fixtureId),
    type,
    period: source.period === "SECOND_HALF" ? "SECOND_HALF" : "FIRST_HALF",
    startMinute: integerValue(source.startMinute, integerValue(source.windowStartMinute)),
    endMinute: integerValue(source.endMinute, integerValue(source.windowEndMinute)),
    opensAt: stringValue(source.opensAt, now),
    locksAt: stringValue(source.locksAt, now),
    startsAt: stringValue(source.startsAt, stringValue(source.locksAt, now)),
    endsAt,
    settlesAt: stringValue(source.settlesAt, addSeconds(endsAt, delay)),
    settlementDelaySeconds: delay,
    status: migrateMarketStatus(source.status),
    openingSnapshot: normalizeSnapshot(source.openingSnapshot),
    closingSnapshot: normalizeSnapshot(source.closingSnapshot),
    result:
      source.result === "YES" || source.result === "NO" || source.result === "VOID"
        ? source.result
        : null,
    settlementReceiptId:
      typeof source.settlementReceiptId === "string" ? source.settlementReceiptId : null,
    question: stringValue(source.question, marketQuestion(type)),
    source: stringValue(source.source, "TxLINE"),
    createdAt: stringValue(source.createdAt, now),
    updatedAt: stringValue(source.updatedAt, stringValue(source.createdAt, now)),
  };
}

function normalizePrediction(key: string, source: Record<string, unknown>): Prediction {
  const now = new Date().toISOString();
  const status = ["PENDING", "LOCKED", "WON", "LOST", "REFUNDED", "VOID"].includes(
    String(source.status),
  )
    ? (source.status as Prediction["status"])
    : "PENDING";
  return {
    predictionId: stringValue(source.predictionId, stringValue(source.id, key)),
    wallet: stringValue(source.wallet),
    marketId: stringValue(source.marketId),
    side: source.side === "NO" || source.selection === "NO" ? "NO" : "YES",
    amount: integerValue(source.amount, integerValue(source.flashPoints)),
    status,
    settlementReceiptId:
      typeof source.settlementReceiptId === "string" ? source.settlementReceiptId : null,
    reward: integerValue(source.reward),
    refund: integerValue(source.refund),
    createdAt: stringValue(source.createdAt, now),
    updatedAt: stringValue(source.updatedAt, stringValue(source.createdAt, now)),
    settledAt: typeof source.settledAt === "string" ? source.settledAt : null,
  };
}

function normalizeAccount(wallet: string, source: FlashPointsAccount): FlashPointsAccount {
  const now = new Date().toISOString();
  const values = [source.available, source.locked, source.won, source.lost, source.refunded];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`Invalid FlashPoints account for ${wallet}`);
  }
  return {
    wallet: source.wallet || wallet,
    available: source.available,
    locked: source.locked,
    won: source.won,
    lost: source.lost,
    refunded: source.refunded,
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now,
  };
}

function normalizeChallenge(key: string, source: Record<string, unknown>): WalletChallenge {
  return {
    challengeId: stringValue(source.challengeId, stringValue(source.id, key)),
    wallet: stringValue(source.wallet),
    message: stringValue(source.message),
    nonce: stringValue(source.nonce),
    origin: stringValue(source.origin),
    createdAt: stringValue(source.createdAt),
    expiresAt: stringValue(source.expiresAt),
    usedAt: typeof source.usedAt === "string" ? source.usedAt : null,
  };
}

function normalizeSession(key: string, source: Record<string, unknown>): WalletSession {
  return {
    tokenHash: stringValue(source.tokenHash, key),
    wallet: stringValue(source.wallet),
    createdAt: stringValue(source.createdAt),
    expiresAt: stringValue(source.expiresAt),
    revokedAt: typeof source.revokedAt === "string" ? source.revokedAt : null,
  };
}

function isCurrentReceipt(source: Record<string, unknown>): boolean {
  return typeof source.receiptId === "string" && typeof source.marketId === "string";
}

export interface MigrationSummary {
  fixtures: number;
  markets: number;
  predictions: number;
  walletAccounts: number;
  settlementReceipts: number;
  authChallenges: number;
  sessions: number;
  skippedLegacyReceipts: number;
}

export async function migrateLegacyState(state: LegacyFlashBetsState): Promise<MigrationSummary> {
  if (state.version !== 2) throw new Error("Only Prompt 1 JSON store version 2 can be migrated");
  return runInTransaction(async (session?: ClientSession) => {
    for (const [key, source] of Object.entries(state.fixtures)) {
      await upsertFixture(normalizeFixture(key, source), session);
    }
    for (const [key, source] of Object.entries(state.markets)) {
      await upsertMarketForMigration(normalizeMarket(key, source), session);
    }
    for (const [key, source] of Object.entries(state.predictions)) {
      await upsertPredictionForMigration(normalizePrediction(key, source), session);
    }
    for (const [wallet, account] of Object.entries(state.flashPointsAccounts)) {
      await upsertWalletAccountForMigration(normalizeAccount(wallet, account), session);
    }
    let migratedReceipts = 0;
    let skippedLegacyReceipts = 0;
    for (const source of Object.values(state.settlementReceipts)) {
      if (isCurrentReceipt(source)) {
        await upsertReceiptForMigration(source as unknown as SettlementReceipt, session);
        migratedReceipts += 1;
      } else {
        skippedLegacyReceipts += 1;
      }
    }
    for (const [key, source] of Object.entries(state.authChallenges)) {
      await upsertChallengeForMigration(normalizeChallenge(key, source), session);
    }
    for (const [key, source] of Object.entries(state.sessions)) {
      await upsertSessionForMigration(normalizeSession(key, source), session);
    }
    return {
      fixtures: Object.keys(state.fixtures).length,
      markets: Object.keys(state.markets).length,
      predictions: Object.keys(state.predictions).length,
      walletAccounts: Object.keys(state.flashPointsAccounts).length,
      settlementReceipts: migratedReceipts,
      authChallenges: Object.keys(state.authChallenges).length,
      sessions: Object.keys(state.sessions).length,
      skippedLegacyReceipts,
    };
  });
}
