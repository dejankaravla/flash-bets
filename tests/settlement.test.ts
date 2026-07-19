import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { Keypair } from "@solana/web3.js";

import type { Prediction } from "../lib/domain/flash-bets.ts";
import { disconnectMongo } from "../lib/server/db/mongoose.ts";
import { readFlashPointsAccount } from "../lib/server/flashpoints-service.ts";
import { advanceMarketRecord } from "../lib/server/market-service.ts";
import { placePrediction } from "../lib/server/prediction-service.ts";
import { distributePool } from "../lib/server/reward-service.ts";
import { findFixture, upsertFixture } from "../lib/server/repositories/fixture-repository.ts";
import { findMarket } from "../lib/server/repositories/market-repository.ts";
import { listPredictionsForMarket } from "../lib/server/repositories/prediction-repository.ts";
import { countReceipts } from "../lib/server/repositories/receipt-repository.ts";
import { clearFlashBetsCollections } from "../lib/server/repositories/test-repository.ts";
import { runInTransaction } from "../lib/server/repositories/transaction-repository.ts";
import { runSettlement, settleMarket } from "../lib/server/settlement-service.ts";
import { fixtureAt, marketAt, seedRecords } from "./helpers.ts";

beforeEach(clearFlashBetsCollections);
after(disconnectMongo);

function wallet(): string {
  return Keypair.generate().publicKey.toBase58();
}

async function advance(marketId: string, nowMs: number) {
  return runInTransaction(async (session) => {
    const market = await findMarket(marketId, session);
    assert.ok(market);
    const fixture = await findFixture(market.fixtureId, session);
    return advanceMarketRecord(market, fixture, nowMs, session);
  });
}

test("market lifecycle is forward-only and captures the opening snapshot once", async () => {
  const base = Date.now();
  const fixture = fixtureAt(base);
  const market = marketAt(base, { status: "CREATED", openingSnapshot: null });
  await seedRecords({ fixture, market });

  const opened = await advance(market.marketId, base);
  assert.equal(opened.status, "OPEN");
  assert.deepEqual(
    { goals: opened.openingSnapshot?.goals, corners: opened.openingSnapshot?.corners },
    { goals: 2, corners: 5 },
  );

  await runInTransaction(async (session) => {
    await upsertFixture(
      fixtureAt(base + 60_000, { goals: 3, corners: 7, sequence: 11 }),
      session,
    );
    return true;
  });
  const locked = await advance(market.marketId, base + 60_000);
  assert.equal(locked.status, "LOCKED");
  assert.equal(locked.openingSnapshot?.goals, 2);
  assert.equal((await advance(market.marketId, base)).status, "LOCKED");
  assert.equal((await advance(market.marketId, base + 390_000)).status, "WAITING_FOR_SETTLEMENT");
});

test("Goal settlement pays exact proportional rewards, finalizes losers, and creates one idempotent receipt", async () => {
  const base = Date.now();
  const fixture = fixtureAt(base);
  const market = marketAt(base);
  const wallets = [wallet(), wallet(), wallet()];
  await seedRecords({ fixture, market });
  await placePrediction({ wallet: wallets[0], marketId: market.marketId, side: "YES", amount: 25, nowMs: base });
  await placePrediction({ wallet: wallets[1], marketId: market.marketId, side: "YES", amount: 75, nowMs: base });
  await placePrediction({ wallet: wallets[2], marketId: market.marketId, side: "NO", amount: 300, nowMs: base });

  const settleAt = base + 510_000;
  await runInTransaction(async (session) => {
    await upsertFixture(
      fixtureAt(settleAt, {
        matchMinute: 40,
        matchSecond: 2_400,
        goals: 3,
        corners: 5,
        sequence: 20,
      }),
      session,
    );
    return true;
  });
  const receipt = await settleMarket(market.marketId, settleAt);
  assert.equal(receipt.winningSide, "YES");
  assert.equal(receipt.calculatedDelta, 1);
  assert.equal(receipt.totalPool, 400);
  assert.deepEqual(
    receipt.awards.filter((award) => award.status === "WON").map((award) => award.reward).sort((a, b) => a - b),
    [100, 300],
  );
  assert.deepEqual(
    {
      first: await readFlashPointsAccount(wallets[0]!),
      second: await readFlashPointsAccount(wallets[1]!),
      loser: await readFlashPointsAccount(wallets[2]!),
    },
    {
      first: {
        ...(await readFlashPointsAccount(wallets[0]!))!,
        available: 1_075,
        locked: 0,
        won: 100,
      },
      second: {
        ...(await readFlashPointsAccount(wallets[1]!))!,
        available: 1_225,
        locked: 0,
        won: 300,
      },
      loser: {
        ...(await readFlashPointsAccount(wallets[2]!))!,
        available: 700,
        locked: 0,
        lost: 300,
      },
    },
  );
  const balancesBeforeDuplicate = await Promise.all(wallets.map(readFlashPointsAccount));
  const duplicate = await settleMarket(market.marketId, settleAt + 1_000);
  assert.equal(duplicate.receiptId, receipt.receiptId);
  assert.deepEqual(await Promise.all(wallets.map(readFlashPointsAccount)), balancesBeforeDuplicate);
  assert.equal(await countReceipts(), 1);
  assert.equal((await findMarket(market.marketId))?.status, "SETTLED");
});

test("Corner settlement uses the corner delta and NO wins when the count is unchanged", async () => {
  const base = Date.now();
  const fixture = fixtureAt(base, { goals: 0, corners: 5 });
  const market = marketAt(base, {
    marketId: "flashbets-v2:20260001:corner:h1:35-40",
    type: "CORNER",
    openingSnapshot: {
      ...marketAt(base).openingSnapshot!,
      goals: 0,
      corners: 5,
    },
    question: "Will there be at least one corner in this window?",
  });
  const noWallet = wallet();
  const yesWallet = wallet();
  await seedRecords({ fixture, market });
  await placePrediction({ wallet: noWallet, marketId: market.marketId, side: "NO", amount: 100, nowMs: base });
  await placePrediction({ wallet: yesWallet, marketId: market.marketId, side: "YES", amount: 100, nowMs: base });
  const settleAt = base + 510_000;
  await runInTransaction(async (session) => {
    await upsertFixture(
      fixtureAt(settleAt, { goals: 0, corners: 5, sequence: 20 }),
      session,
    );
    return true;
  });
  const receipt = await settleMarket(market.marketId, settleAt);
  assert.equal(receipt.winningSide, "NO");
  assert.equal(receipt.calculatedDelta, 0);
  assert.equal((await readFlashPointsAccount(noWallet))?.available, 1_100);
  assert.equal((await readFlashPointsAccount(yesWallet))?.lost, 100);
});

test("void settlement refunds every locked point and records the reason", async () => {
  const base = Date.now();
  const fixture = fixtureAt(base);
  const market = marketAt(base);
  const owner = wallet();
  await seedRecords({ fixture, market });
  await placePrediction({ wallet: owner, marketId: market.marketId, side: "YES", amount: 250, nowMs: base });
  const settleAt = base + 510_000;
  await runInTransaction(async (session) => {
    await upsertFixture(
      fixtureAt(settleAt, { phase: "ABANDONED", sequence: 20 }),
      session,
    );
    return true;
  });
  const receipt = await settleMarket(market.marketId, settleAt);
  const account = await readFlashPointsAccount(owner);
  assert.equal(receipt.settlementReason, "FIXTURE_ABANDONED_OR_CANCELLED");
  assert.deepEqual(
    { available: account?.available, locked: account?.locked, refunded: account?.refunded },
    { available: 1_000, locked: 0, refunded: 250 },
  );
  assert.equal((await listPredictionsForMarket(market.marketId))[0]?.status, "VOID");
  assert.equal((await findMarket(market.marketId))?.status, "VOID");
});

test("settlement refuses to run before the correction delay elapses", async () => {
  const base = Date.now();
  const fixture = fixtureAt(base);
  const market = marketAt(base);
  await seedRecords({ fixture, market });
  await assert.rejects(
    settleMarket(market.marketId, new Date(market.settlesAt).getTime() - 1),
    (error: unknown) => (error as { code?: string }).code === "SETTLEMENT_DELAY_ACTIVE",
  );
  assert.equal(await countReceipts(), 0);
});

test("integer reward remainder goes to lexical prediction IDs deterministically", () => {
  const base = Date.now();
  const makePrediction = (predictionId: string, side: "YES" | "NO"): Prediction => ({
    predictionId,
    marketId: "market",
    wallet: predictionId,
    side,
    amount: 1,
    status: "LOCKED",
    settlementReceiptId: null,
    reward: 0,
    refund: 0,
    createdAt: new Date(base).toISOString(),
    updatedAt: new Date(base).toISOString(),
    settledAt: null,
  });
  const result = distributePool(
    [makePrediction("winner-c", "YES"), makePrediction("winner-a", "YES"), makePrediction("winner-b", "YES"), makePrediction("loser", "NO")],
    "YES",
  );
  assert.equal(result.remainder, 1);
  assert.deepEqual(
    result.awards.filter((award) => award.status === "WON").map((award) => [award.predictionId, award.reward]).sort(),
    [["winner-a", 2], ["winner-b", 1], ["winner-c", 1]],
  );
});

test("the worker-style runner advances due markets and settles without HTTP", async () => {
  const base = Date.now();
  const fixture = fixtureAt(base);
  const market = marketAt(base);
  await seedRecords({ fixture, market });
  const settleAt = base + 510_000;
  await runInTransaction(async (session) => {
    await upsertFixture(fixtureAt(settleAt, { goals: 2, sequence: 20 }), session);
    return true;
  });
  const result = await runSettlement(settleAt);
  assert.equal(result.dueMarkets, 1);
  assert.equal(result.settled, 1);
  assert.equal(result.errors.length, 0);
});

test("concurrent standalone settlement cannot duplicate a reward or receipt", async () => {
  const base = Date.now();
  const fixture = fixtureAt(base);
  const market = marketAt(base);
  const winner = wallet();
  const loser = wallet();
  await seedRecords({ fixture, market });
  await placePrediction({ wallet: winner, marketId: market.marketId, side: "YES", amount: 100, nowMs: base });
  await placePrediction({ wallet: loser, marketId: market.marketId, side: "NO", amount: 100, nowMs: base });
  const settleAt = base + 510_000;
  await runInTransaction(async (session) => {
    await upsertFixture(fixtureAt(settleAt, { goals: 3, sequence: 20 }), session);
    return true;
  });
  const [first, second] = await Promise.all([
    settleMarket(market.marketId, settleAt),
    settleMarket(market.marketId, settleAt),
  ]);
  assert.equal(first.receiptId, second.receiptId);
  assert.equal(await countReceipts(), 1);
  assert.deepEqual(
    {
      winnerAvailable: (await readFlashPointsAccount(winner))?.available,
      winnerLocked: (await readFlashPointsAccount(winner))?.locked,
      winnerWon: (await readFlashPointsAccount(winner))?.won,
      loserAvailable: (await readFlashPointsAccount(loser))?.available,
      loserLocked: (await readFlashPointsAccount(loser))?.locked,
      loserLost: (await readFlashPointsAccount(loser))?.lost,
    },
    {
      winnerAvailable: 1_100,
      winnerLocked: 0,
      winnerWon: 200,
      loserAvailable: 900,
      loserLocked: 0,
      loserLost: 100,
    },
  );
});
