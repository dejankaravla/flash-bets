import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";

import type { LegacyFlashBetsState } from "../lib/domain/flash-bets.ts";
import { disconnectMongo } from "../lib/server/db/mongoose.ts";
import { migrateLegacyState } from "../lib/server/migration-service.ts";
import { findFixture } from "../lib/server/repositories/fixture-repository.ts";
import { findMarket } from "../lib/server/repositories/market-repository.ts";
import { listPredictionsForWalletRecord } from "../lib/server/repositories/prediction-repository.ts";
import {
  clearFlashBetsCollections,
  flashBetsCollectionCounts,
} from "../lib/server/repositories/test-repository.ts";
import { findWalletAccount } from "../lib/server/repositories/wallet-account-repository.ts";

beforeEach(clearFlashBetsCollections);
after(disconnectMongo);

test("Prompt 1 JSON migration preserves IDs, balances, fixtures, markets, and predictions and is idempotent", async () => {
  const now = new Date().toISOString();
  const wallet = "11111111111111111111111111111111";
  const marketId = "flashbets-v2:20260001:goal:h1:35-40";
  const predictionId = "prediction:legacy";
  const state: LegacyFlashBetsState = {
    version: 2,
    fixtures: {
      "20260001": {
        id: "20260001",
        participants: ["Brazil", "Argentina"],
        phase: "FIRST_HALF",
        matchMinute: 32,
        matchSecond: 1_920,
        goals: 2,
        corners: 5,
        sequence: 10,
        sourceTimestamp: now,
        sourceTimestampTrusted: true,
        receivedAt: now,
        source: "TxLINE",
        complete: true,
      },
    },
    markets: {
      [marketId]: {
        id: marketId,
        fixtureId: "20260001",
        type: "GOAL",
        period: "FIRST_HALF",
        windowStartMinute: 35,
        windowEndMinute: 40,
        opensAt: now,
        locksAt: now,
        startsAt: now,
        endsAt: now,
        status: "SCHEDULED",
        question: "Will there be at least one goal in this window?",
        source: "TxLINE",
        createdAt: now,
      },
    },
    predictions: {
      [predictionId]: {
        id: predictionId,
        marketId,
        wallet,
        selection: "YES",
        flashPoints: 100,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      },
    },
    flashPointsAccounts: {
      [wallet]: {
        wallet,
        available: 900,
        locked: 100,
        won: 0,
        lost: 0,
        refunded: 0,
        createdAt: now,
        updatedAt: now,
      },
    },
    settlementReceipts: {},
    authChallenges: {},
    sessions: {},
  };

  const first = await migrateLegacyState(state);
  const second = await migrateLegacyState(state);
  assert.deepEqual(second, first);
  assert.equal((await findFixture("20260001"))?.fixtureId, "20260001");
  assert.equal((await findMarket(marketId))?.marketId, marketId);
  assert.equal((await findMarket(marketId))?.startMinute, 35);
  assert.equal((await listPredictionsForWalletRecord(wallet))[0]?.predictionId, predictionId);
  assert.deepEqual(
    { available: (await findWalletAccount(wallet))?.available, locked: (await findWalletAccount(wallet))?.locked },
    { available: 900, locked: 100 },
  );
  const counts = await flashBetsCollectionCounts();
  assert.equal(counts.fixtures, 1);
  assert.equal(counts.markets, 1);
  assert.equal(counts.predictions, 1);
  assert.equal(counts.wallet_accounts, 1);
});
