import "server-only";

import type {
  Fixture,
  Market,
  Prediction,
  PredictionSelection,
  SettlementReceipt,
  TxLineSnapshot,
} from "@/lib/domain/flash-bets";
import { ApiError } from "@/lib/server/errors";
import { advanceAllMarketLifecycles } from "@/lib/server/market-service";
import { refundPool, distributePool, type PoolDistribution } from "@/lib/server/reward-service";
import { findFixture } from "@/lib/server/repositories/fixture-repository";
import {
  finalizeMarket,
  findMarket,
  listDueMarkets,
  transitionMarket,
} from "@/lib/server/repositories/market-repository";
import {
  finalizePrediction,
  listPredictionsForMarket,
  markPredictionsLocked,
} from "@/lib/server/repositories/prediction-repository";
import { applyWalletSettlement } from "@/lib/server/repositories/wallet-account-repository";
import {
  canonicalReceiptId,
  persistSettlementReceipt,
  readReceiptForMarket,
  SETTLEMENT_VERSION,
} from "@/lib/server/receipt-service";
import { captureTxLineSnapshot } from "@/lib/server/txline-snapshot-service";
import { applicationNowMs } from "@/lib/server/application-clock";
import { publishWalletActivity } from "@/lib/server/activity-stream";

export const DEFAULT_SETTLEMENT_TIMEOUT_SECONDS = 15 * 60;

function settlementTimeoutSeconds(): number {
  const parsed = Number(process.env.SETTLEMENT_TIMEOUT_SECONDS);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_SETTLEMENT_TIMEOUT_SECONDS;
}

interface SettlementDecision {
  result: PredictionSelection | "VOID";
  reason: string;
  closingSnapshot: TxLineSnapshot | null;
  delta: number | null;
  winningSide: PredictionSelection | null;
}

function voidDecision(reason: string, closingSnapshot: TxLineSnapshot | null): SettlementDecision {
  return {
    result: "VOID",
    reason,
    closingSnapshot,
    delta: null,
    winningSide: null,
  };
}

export function decideSettlement(input: {
  market: Market;
  fixture: Fixture | null;
  nowMs: number;
}): SettlementDecision {
  const { market, fixture, nowMs } = input;
  if (
    nowMs >
    new Date(market.settlesAt).getTime() + settlementTimeoutSeconds() * 1_000
  ) {
    return voidDecision("SETTLEMENT_TIMEOUT_EXCEEDED", null);
  }
  if (!fixture) return voidDecision("FIXTURE_MISSING", null);
  if (fixture.phase === "ABANDONED" || fixture.phase === "POSTPONED") {
    return voidDecision("FIXTURE_ABANDONED_OR_CANCELLED", null);
  }
  if (fixture.phase === "UNKNOWN") return voidDecision("FIXTURE_UNKNOWN", null);
  if (!fixture.complete || !fixture.sourceTimestampTrusted) {
    return voidDecision("TXLINE_DATA_MISSING", null);
  }
  const latestSourceMs = new Date(fixture.sourceTimestamp).getTime();
  if (
    !Number.isFinite(latestSourceMs) ||
    latestSourceMs < new Date(market.endsAt).getTime()
  ) {
    return voidDecision("TXLINE_DATA_MISSING", null);
  }
  if (!market.openingSnapshot) return voidDecision("OPENING_SNAPSHOT_MISSING", null);
  const closingSnapshot = captureTxLineSnapshot(fixture, new Date(nowMs).toISOString());
  if (!closingSnapshot) return voidDecision("CLOSING_SNAPSHOT_MISSING", null);

  try {
    const openingCount =
      market.type === "GOAL"
        ? market.openingSnapshot.goals
        : market.openingSnapshot.corners;
    const closingCount =
      market.type === "GOAL" ? closingSnapshot.goals : closingSnapshot.corners;
    const delta = closingCount - openingCount;
    if (!Number.isSafeInteger(delta) || delta < 0) {
      return voidDecision("INTERNAL_CALCULATION_ERROR", closingSnapshot);
    }
    const winningSide: PredictionSelection = delta > 0 ? "YES" : "NO";
    return {
      result: winningSide,
      reason: "DELTA_CALCULATED",
      closingSnapshot,
      delta,
      winningSide,
    };
  } catch {
    return voidDecision("INTERNAL_CALCULATION_ERROR", closingSnapshot);
  }
}

function distributionForDecision(
  predictions: Prediction[],
  decision: SettlementDecision,
): { decision: SettlementDecision; distribution: PoolDistribution } {
  if (decision.result === "VOID" || !decision.winningSide) {
    return { decision, distribution: refundPool(predictions) };
  }
  try {
    const distribution = distributePool(predictions, decision.winningSide);
    if (distribution.totalPool > 0 && distribution.winningPool === 0) {
      const voided = voidDecision("NO_WINNING_PREDICTIONS", decision.closingSnapshot);
      return { decision: voided, distribution: refundPool(predictions) };
    }
    return { decision, distribution };
  } catch {
    const voided = voidDecision("INTERNAL_CALCULATION_ERROR", decision.closingSnapshot);
    return { decision: voided, distribution: refundPool(predictions) };
  }
}

function receiptForSettlement(input: {
  market: Market;
  decision: SettlementDecision;
  distribution: PoolDistribution;
  createdAt: string;
}): SettlementReceipt {
  const { market, decision, distribution, createdAt } = input;
  return {
    receiptId: canonicalReceiptId(market.marketId),
    marketId: market.marketId,
    fixtureId: market.fixtureId,
    settlementReason: decision.reason,
    txLineOpeningTimestamp: market.openingSnapshot?.sourceTimestamp ?? null,
    txLineClosingTimestamp: decision.closingSnapshot?.sourceTimestamp ?? null,
    openingSnapshot: market.openingSnapshot,
    closingSnapshot: decision.closingSnapshot,
    calculatedDelta: decision.delta,
    winningSide: decision.winningSide,
    correctionDelaySeconds: market.settlementDelaySeconds,
    settlementVersion: SETTLEMENT_VERSION,
    totalPool: distribution.totalPool,
    winningPool: distribution.winningPool,
    remainder: distribution.remainder,
    awards: distribution.awards,
    createdAt,
  };
}

export async function settleMarket(
  marketId: string,
  nowMs = applicationNowMs(),
): Promise<SettlementReceipt> {
  let receipt = await readReceiptForMarket(marketId);
  if (!receipt) {
    let market = await findMarket(marketId);
    if (!market) throw new ApiError("UNKNOWN_MARKET", "Market does not exist", 404);
    if (market.status === "SETTLED" || market.status === "VOID") {
      receipt = await readReceiptForMarket(marketId);
      if (!receipt) throw new Error("Final market is missing its settlement receipt");
    } else {
      if (nowMs < new Date(market.settlesAt).getTime()) {
        throw new ApiError(
          "SETTLEMENT_DELAY_ACTIVE",
          "Market correction delay has not elapsed",
          409,
        );
      }

      if (market.status !== "WAITING_FOR_SETTLEMENT") {
        const waiting = await transitionMarket({
          marketId: market.marketId,
          from: [market.status],
          to: "WAITING_FOR_SETTLEMENT",
          updatedAt: new Date(nowMs).toISOString(),
        });
        if (waiting) market = waiting;
        else {
          const current = await findMarket(market.marketId);
          if (!current) throw new Error("Market disappeared during settlement");
          market = current;
        }
      }
      await markPredictionsLocked(market.marketId, new Date(nowMs).toISOString());

      const fixture = await findFixture(market.fixtureId);
      const predictions = await listPredictionsForMarket(market.marketId);
      const initialDecision = decideSettlement({ market, fixture, nowMs });
      const { decision, distribution } = distributionForDecision(predictions, initialDecision);
      const candidate = receiptForSettlement({
        market,
        decision,
        distribution,
        createdAt: new Date(nowMs).toISOString(),
      });
      receipt = await persistSettlementReceipt(candidate);
    }
  }

  for (const award of receipt.awards) {
    const accountResult = await applyWalletSettlement({
      wallet: award.wallet,
      settlementReceiptId: receipt.receiptId,
      lockedDecrease: award.amount,
      availableIncrease: award.reward + award.refund,
      wonIncrease: award.status === "WON" ? award.reward : 0,
      lostIncrease: award.status === "LOST" ? award.amount : 0,
      refundedIncrease: award.status === "VOID" ? award.refund : 0,
      updatedAt: receipt.createdAt,
    });
    if (accountResult === "FAILED") {
      throw new Error(`FlashPoints accounting invariant failed for ${award.wallet}`);
    }
    const prediction = await finalizePrediction({
      predictionId: award.predictionId,
      status: award.status,
      settlementReceiptId: receipt.receiptId,
      reward: award.reward,
      refund: award.refund,
      settledAt: receipt.createdAt,
    });
    if (!prediction) throw new Error(`Prediction settlement invariant failed: ${award.predictionId}`);
  }

  const result = receipt.winningSide ?? "VOID";
  const finalized = await finalizeMarket({
    marketId: receipt.marketId,
    status: result === "VOID" ? "VOID" : "SETTLED",
    closingSnapshot: receipt.closingSnapshot,
    result,
    settlementReceiptId: receipt.receiptId,
    updatedAt: receipt.createdAt,
  });
  if (!finalized) throw new Error("Market settlement invariant failed");

  for (const award of receipt.awards) {
    publishWalletActivity(award.wallet, {
      type: "settlement",
      id: receipt.receiptId,
      occurredAt: receipt.createdAt,
    });
  }
  return receipt;
}

export interface SettlementRunResult {
  lifecycleTransitions: number;
  dueMarkets: number;
  settled: number;
  voided: number;
  receipts: SettlementReceipt[];
  errors: Array<{ marketId: string; error: string }>;
}

export async function runSettlement(nowMs = applicationNowMs()): Promise<SettlementRunResult> {
  const lifecycleTransitions = await advanceAllMarketLifecycles(nowMs);
  const due = await listDueMarkets(new Date(nowMs).toISOString());
  const receipts: SettlementReceipt[] = [];
  const errors: Array<{ marketId: string; error: string }> = [];
  for (const market of due) {
    try {
      receipts.push(await settleMarket(market.marketId, nowMs));
    } catch (error) {
      errors.push({
        marketId: market.marketId,
        error: error instanceof Error ? error.message : "Settlement failed",
      });
    }
  }
  return {
    lifecycleTransitions,
    dueMarkets: due.length,
    settled: receipts.filter((receipt) => receipt.winningSide !== null).length,
    voided: receipts.filter((receipt) => receipt.winningSide === null).length,
    receipts,
    errors,
  };
}
