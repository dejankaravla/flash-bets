import type {
  Fixture,
  FlashPointsAccount,
  Market,
  TxLineSnapshot,
} from "../lib/domain/flash-bets.ts";
import { upsertFixture } from "../lib/server/repositories/fixture-repository.ts";
import { upsertMarketForMigration } from "../lib/server/repositories/market-repository.ts";
import { runInTransaction } from "../lib/server/repositories/transaction-repository.ts";
import { upsertWalletAccountForMigration } from "../lib/server/repositories/wallet-account-repository.ts";

export function fixtureAt(nowMs: number, overrides: Partial<Fixture> = {}): Fixture {
  const now = new Date(nowMs).toISOString();
  return {
    fixtureId: "20260001",
    participants: ["Brazil", "Argentina"],
    phase: "FIRST_HALF",
    matchMinute: 32,
    matchSecond: 32 * 60,
    goals: 2,
    corners: 5,
    sequence: 10,
    sourceTimestamp: now,
    sourceTimestampTrusted: true,
    receivedAt: now,
    source: "TxLINE",
    complete: true,
    updatedAt: now,
    ...overrides,
  };
}

export function snapshotAt(fixture: Fixture, capturedAt = fixture.receivedAt): TxLineSnapshot {
  if (fixture.goals === null || fixture.corners === null) throw new Error("Fixture is incomplete");
  return {
    goals: fixture.goals,
    corners: fixture.corners,
    sequence: fixture.sequence,
    matchSecond: fixture.matchSecond,
    phase: fixture.phase,
    sourceTimestamp: fixture.sourceTimestamp,
    receivedAt: fixture.receivedAt,
    capturedAt,
  };
}

export function marketAt(
  baseMs: number,
  overrides: Partial<Market> = {},
): Market {
  const fixture = fixtureAt(baseMs);
  const createdAt = new Date(baseMs).toISOString();
  return {
    marketId: "flashbets-v2:20260001:goal:h1:35-40",
    fixtureId: fixture.fixtureId,
    type: "GOAL",
    period: "FIRST_HALF",
    startMinute: 35,
    endMinute: 40,
    opensAt: new Date(baseMs - 60_000).toISOString(),
    locksAt: new Date(baseMs + 60_000).toISOString(),
    startsAt: new Date(baseMs + 90_000).toISOString(),
    endsAt: new Date(baseMs + 390_000).toISOString(),
    settlesAt: new Date(baseMs + 510_000).toISOString(),
    settlementDelaySeconds: 120,
    status: "OPEN",
    openingSnapshot: snapshotAt(fixture),
    closingSnapshot: null,
    result: null,
    settlementReceiptId: null,
    question: "Will there be at least one goal in this window?",
    source: "TxLINE",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

export async function seedRecords(input: {
  fixture: Fixture;
  market?: Market;
  accounts?: FlashPointsAccount[];
}): Promise<void> {
  await runInTransaction(async (session) => {
    await upsertFixture(input.fixture, session);
    if (input.market) await upsertMarketForMigration(input.market, session);
    for (const account of input.accounts ?? []) {
      await upsertWalletAccountForMigration(account, session);
    }
    return true;
  });
}
