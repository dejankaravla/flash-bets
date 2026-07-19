import "server-only";

import { createHash } from "node:crypto";

import type {
  Prediction,
  PredictionSelection,
  PredictionView,
} from "@/lib/domain/flash-bets";
import { fixtureIsFresh, isMarketEligiblePhase } from "@/lib/market-policy";
import { ApiError } from "@/lib/server/errors";
import { ensureFlashPointsAccount } from "@/lib/server/flashpoints-service";
import { advanceMarketRecord, txLineStaleAfterSeconds } from "@/lib/server/market-service";
import { findFixture } from "@/lib/server/repositories/fixture-repository";
import { findMarket } from "@/lib/server/repositories/market-repository";
import {
  createPrediction,
  deletePredictionReservation,
  findPrediction,
  listPredictionsForWalletRecord,
} from "@/lib/server/repositories/prediction-repository";
import { findReceiptsByIds } from "@/lib/server/repositories/receipt-repository";
import { runInTransaction } from "@/lib/server/repositories/transaction-repository";
import { lockWalletPoints } from "@/lib/server/repositories/wallet-account-repository";
import { applicationNowMs } from "@/lib/server/application-clock";
import { publishWalletActivity } from "@/lib/server/activity-stream";

export function canonicalPredictionId(wallet: string, marketId: string): string {
  return `prediction:${createHash("sha256").update(`${wallet}:${marketId}`).digest("hex").slice(0, 32)}`;
}

function readSelection(value: unknown): PredictionSelection {
  if (value !== "YES" && value !== "NO") {
    throw new ApiError("INVALID_SELECTION", "Prediction must be YES or NO", 400);
  }
  return value;
}

function readAmount(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new ApiError(
      "INVALID_FLASHPOINTS",
      "FlashPoints must be a positive whole number",
      400,
    );
  }
  return value as number;
}

export async function placePrediction(input: {
  wallet: string;
  marketId: unknown;
  side?: unknown;
  amount?: unknown;
  selection?: unknown;
  flashPoints?: unknown;
  nowMs?: number;
}): Promise<Prediction> {
  if (typeof input.marketId !== "string" || input.marketId.length > 200) {
    throw new ApiError("UNKNOWN_MARKET", "Market does not exist", 404);
  }
  const side = readSelection(input.side ?? input.selection);
  const amount = readAmount(input.amount ?? input.flashPoints);
  const nowMs = input.nowMs ?? applicationNowMs();
  const predictionId = canonicalPredictionId(input.wallet, input.marketId);

  try {
    const prediction = await runInTransaction(async (session) => {
      const marketRecord = await findMarket(input.marketId as string, session);
      if (!marketRecord) throw new ApiError("UNKNOWN_MARKET", "Market does not exist", 404);
      const fixture = await findFixture(marketRecord.fixtureId, session);
      const market = await advanceMarketRecord(marketRecord, fixture, nowMs, session);
      if (
        !fixture ||
        !isMarketEligiblePhase(fixture.phase) ||
        !fixtureIsFresh(fixture, nowMs, txLineStaleAfterSeconds())
      ) {
        throw new ApiError(
          "FIXTURE_NOT_FRESH",
          "Fixture data is unavailable or stale",
          409,
        );
      }
      if (market.status !== "OPEN") {
        throw new ApiError("MARKET_NOT_OPEN", "Market is not open", 409);
      }
      if (await findPrediction(predictionId, session)) {
        throw new ApiError(
          "PREDICTION_EXISTS",
          "This wallet already predicted on this market",
          409,
        );
      }

      const now = new Date(nowMs).toISOString();
      await ensureFlashPointsAccount(input.wallet, session, now);
      const predictionRecord: Prediction = {
        predictionId,
        marketId: market.marketId,
        wallet: input.wallet,
        side,
        amount,
        status: "PENDING",
        settlementReceiptId: null,
        reward: 0,
        refund: 0,
        createdAt: now,
        updatedAt: now,
        settledAt: null,
      };

      if (session) {
        const account = await lockWalletPoints({
          wallet: input.wallet,
          amount,
          updatedAt: now,
          session,
        });
        if (!account) {
          throw new ApiError(
            "INSUFFICIENT_FLASHPOINTS",
            "Not enough available FlashPoints",
            409,
          );
        }
        return createPrediction(predictionRecord, session);
      }

      const prediction = await createPrediction(predictionRecord);
      const account = await lockWalletPoints({
        wallet: input.wallet,
        amount,
        updatedAt: now,
      });
      if (!account) {
        const removed = await deletePredictionReservation(prediction.predictionId);
        if (!removed) {
          throw new Error("Prediction reservation compensation failed");
        }
        throw new ApiError(
          "INSUFFICIENT_FLASHPOINTS",
          "Not enough available FlashPoints",
          409,
        );
      }
      return prediction;
    });
    publishWalletActivity(input.wallet, {
      type: "prediction",
      id: prediction.predictionId,
      occurredAt: prediction.createdAt,
    });
    return prediction;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new ApiError(
        "PREDICTION_EXISTS",
        "This wallet already predicted on this market",
        409,
      );
    }
    throw error;
  }
}

export async function listPredictionsForWallet(
  wallet: string,
): Promise<PredictionView[]> {
  const predictions = await listPredictionsForWalletRecord(wallet);
  const receiptIds = predictions
    .map((prediction) => prediction.settlementReceiptId)
    .filter((value): value is string => value !== null);
  const receipts = new Map(
    (await findReceiptsByIds(receiptIds)).map((receipt) => [receipt.receiptId, receipt]),
  );
  const markets = new Map<string, Awaited<ReturnType<typeof findMarket>>>();
  for (const marketId of new Set(predictions.map((prediction) => prediction.marketId))) {
    markets.set(marketId, await findMarket(marketId));
  }
  const fixtures = new Map<string, Awaited<ReturnType<typeof findFixture>>>();
  for (const market of markets.values()) {
    if (market && !fixtures.has(market.fixtureId)) {
      fixtures.set(market.fixtureId, await findFixture(market.fixtureId));
    }
  }
  return predictions.map((prediction) => {
    const market = markets.get(prediction.marketId) ?? null;
    return {
      ...prediction,
      market,
      fixture: market ? fixtures.get(market.fixtureId) ?? null : null,
      receipt: prediction.settlementReceiptId
        ? receipts.get(prediction.settlementReceiptId) ?? null
        : null,
    };
  });
}
