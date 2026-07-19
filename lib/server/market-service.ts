import "server-only";

import type { ClientSession } from "mongoose";

import type { Fixture, Market } from "@/lib/domain/flash-bets";
import {
  DEFAULT_MARKET_LEAD_MINUTES,
  DEFAULT_SETTLEMENT_DELAY_SECONDS,
  DEFAULT_TXLINE_STALE_AFTER_SECONDS,
  absoluteMatchMinute,
  canTransitionMarket,
  deriveCanonicalMarkets,
  fixtureIsFresh,
  projectedLifecycleStatus,
} from "@/lib/market-policy";
import { findFixture, upsertFixture } from "@/lib/server/repositories/fixture-repository";
import {
  findMarket,
  insertMarketIfAbsent,
  listMarketsForFixture,
  listUnfinishedMarkets,
  transitionMarket,
} from "@/lib/server/repositories/market-repository";
import { markPredictionsLocked } from "@/lib/server/repositories/prediction-repository";
import { runInTransaction } from "@/lib/server/repositories/transaction-repository";
import { captureTxLineSnapshot } from "@/lib/server/txline-snapshot-service";
import { applicationNowMs } from "@/lib/server/application-clock";
import { STAT_KEY, type TxLineScoresUpdate } from "@/lib/types/txline";

function envInteger(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function txLineStaleAfterSeconds(): number {
  return envInteger(
    "FLASHBETS_TXLINE_STALE_AFTER_SECONDS",
    DEFAULT_TXLINE_STALE_AFTER_SECONDS,
  );
}

export function settlementDelaySeconds(): number {
  return envInteger("SETTLEMENT_DELAY_SECONDS", DEFAULT_SETTLEMENT_DELAY_SECONDS);
}

function normalizeTimestamp(value: number): string | null {
  const milliseconds = value < 1_000_000_000_000 ? value * 1_000 : value;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function sumStats(
  scores: TxLineScoresUpdate,
  left: number,
  right: number,
): number | null {
  if (!scores.availableStats.includes(left) || !scores.availableStats.includes(right)) {
    return null;
  }
  const total = scores.stats[left] + scores.stats[right];
  return Number.isInteger(total) && total >= 0 ? total : null;
}

export function toSettlementFixture(
  scores: TxLineScoresUpdate,
  nowMs = Date.now(),
  context: IngestSourceContext = {},
): Fixture | null {
  const sourceTimestamp = normalizeTimestamp(scores.ts);
  if (!sourceTimestamp) return null;
  const matchMinute = absoluteMatchMinute(scores.matchPhase, scores.matchMinute);
  const goals = sumStats(scores, STAT_KEY.P1_GOALS, STAT_KEY.P2_GOALS);
  const corners = sumStats(scores, STAT_KEY.P1_CORNERS, STAT_KEY.P2_CORNERS);
  const receivedAt = new Date(nowMs).toISOString();
  return {
    fixtureId: String(scores.fixtureId),
    participants: scores.participants,
    phase: scores.matchPhase,
    matchMinute,
    matchSecond: matchMinute * 60,
    goals,
    corners,
    sequence: scores.seq,
    sourceTimestamp,
    sourceTimestampTrusted: scores.sourceTimestampTrusted,
    receivedAt,
    source:
      context.sourceLabel ||
      process.env.TXLINE_API_URL?.trim() ||
      "https://txline-dev.txodds.com",
    sourceMode: context.sourceMode ?? "LIVE",
    replayId: context.replayId ?? null,
    replayRunId: context.replayRunId ?? null,
    complete:
      scores.sourceTimestampTrusted &&
      scores.matchPhase !== "UNKNOWN" &&
      goals !== null &&
      corners !== null,
    updatedAt: receivedAt,
  };
}

export interface IngestSourceContext {
  sourceMode?: "LIVE" | "REPLAY";
  sourceLabel?: string;
  replayId?: string;
  replayRunId?: string;
}

export function isNewerFixture(previous: Fixture | null, next: Fixture): boolean {
  if (!previous) return true;
  if (next.sequence !== previous.sequence) return next.sequence > previous.sequence;
  const nextTime = new Date(next.sourceTimestamp).getTime();
  const previousTime = new Date(previous.sourceTimestamp).getTime();
  if (nextTime !== previousTime) return nextTime > previousTime;
  return (
    next.phase !== previous.phase ||
    next.matchSecond !== previous.matchSecond ||
    next.goals !== previous.goals ||
    next.corners !== previous.corners
  );
}

export async function advanceMarketRecord(
  market: Market,
  fixture: Fixture | null,
  nowMs: number,
  session?: ClientSession,
): Promise<Market> {
  if (market.status === "SETTLED" || market.status === "VOID") return market;
  const projected = projectedLifecycleStatus(market, nowMs);
  const target = canTransitionMarket(market.status, projected) ? projected : market.status;
  const now = new Date(nowMs).toISOString();
  const shouldCaptureOpening =
    market.openingSnapshot === null &&
    target === "OPEN" &&
    nowMs >= new Date(market.opensAt).getTime();
  const openingSnapshot = shouldCaptureOpening
    ? captureTxLineSnapshot(fixture, now)
    : undefined;
  if (target === market.status && openingSnapshot === undefined) return market;

  const transitioned = await transitionMarket({
    marketId: market.marketId,
    from: [market.status],
    to: target,
    updatedAt: now,
    openingSnapshot,
    session,
  });
  const current = transitioned ?? (await findMarket(market.marketId, session)) ?? market;
  if (current.status === "LOCKED" || current.status === "WAITING_FOR_SETTLEMENT") {
    await markPredictionsLocked(current.marketId, now, session);
  }
  return current;
}

export async function ingestTxLineScores(
  scores: TxLineScoresUpdate,
  nowMs = Date.now(),
  context: IngestSourceContext = {},
): Promise<boolean> {
  const fixture = toSettlementFixture(scores, nowMs, context);
  if (!fixture) return false;

  return runInTransaction(async (session) => {
    const previous = await findFixture(fixture.fixtureId, session);
    if (!isNewerFixture(previous, fixture)) return false;
    await upsertFixture(fixture, session);

    const candidates = deriveCanonicalMarkets(fixture, {
      marketLeadMinutes: envInteger(
        "FLASHBETS_MARKET_LEAD_MINUTES",
        DEFAULT_MARKET_LEAD_MINUTES,
      ),
      staleAfterSeconds: txLineStaleAfterSeconds(),
      settlementDelaySeconds: settlementDelaySeconds(),
      nowMs,
    });
    for (const candidate of candidates) await insertMarketIfAbsent(candidate, session);
    const markets = await listMarketsForFixture(fixture.fixtureId, session);
    for (const market of markets) {
      await advanceMarketRecord(market, fixture, nowMs, session);
    }
    return true;
  });
}

export async function advanceAllMarketLifecycles(nowMs = Date.now()): Promise<number> {
  const markets = await listUnfinishedMarkets();
  let changed = 0;
  for (const candidate of markets) {
    const didChange = await runInTransaction(async (session) => {
      const market = await findMarket(candidate.marketId, session);
      if (!market || market.status === "SETTLED" || market.status === "VOID") return false;
      const fixture = await findFixture(market.fixtureId, session);
      const advanced = await advanceMarketRecord(market, fixture, nowMs, session);
      return advanced.status !== market.status || advanced.openingSnapshot !== market.openingSnapshot;
    });
    if (didChange) changed += 1;
  }
  return changed;
}

export interface MarketListView {
  fixture: Fixture | null;
  fixtureFresh: boolean;
  markets: Market[];
}

export async function listCanonicalMarkets(fixtureId: string): Promise<MarketListView> {
  const nowMs = applicationNowMs();
  await runInTransaction(async (session) => {
    const fixture = await findFixture(fixtureId, session);
    const markets = await listMarketsForFixture(fixtureId, session);
    for (const market of markets) {
      await advanceMarketRecord(market, fixture, nowMs, session);
    }
    return true;
  });
  const fixture = await findFixture(fixtureId);
  const markets = await listMarketsForFixture(fixtureId);
  const staleAfterSeconds = txLineStaleAfterSeconds();
  return {
    fixture,
    fixtureFresh: fixture ? fixtureIsFresh(fixture, nowMs, staleAfterSeconds) : false,
    markets,
  };
}
