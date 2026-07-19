import {
  marketQuestion,
  type Fixture,
  type Market,
  type MarketPeriod,
  type MarketStatus,
  type MatchPhase,
  type SupportedMarketType,
  type TxLineSnapshot,
} from "@/lib/domain/flash-bets";

export const MARKET_WINDOW_MINUTES = 5;
export const MARKET_LOCK_SECONDS = 30;
export const DEFAULT_MARKET_LEAD_MINUTES = 15;
export const DEFAULT_TXLINE_STALE_AFTER_SECONDS = 45;
export const DEFAULT_SETTLEMENT_DELAY_SECONDS = 120;

const MARKET_TYPES: SupportedMarketType[] = ["GOAL", "CORNER"];
const STATUS_ORDER: MarketStatus[] = [
  "CREATED",
  "OPEN",
  "LOCKED",
  "WAITING_FOR_SETTLEMENT",
  "SETTLED",
  "VOID",
];

export interface MarketPolicyConfig {
  marketLeadMinutes: number;
  staleAfterSeconds: number;
  settlementDelaySeconds: number;
  nowMs: number;
}

export function isMarketEligiblePhase(
  phase: MatchPhase,
): phase is "FIRST_HALF" | "SECOND_HALF" {
  return phase === "FIRST_HALF" || phase === "SECOND_HALF";
}

export function periodForPhase(phase: MatchPhase): MarketPeriod | null {
  if (phase === "FIRST_HALF") return "FIRST_HALF";
  if (phase === "SECOND_HALF") return "SECOND_HALF";
  return null;
}

export function absoluteMatchMinute(
  phase: MatchPhase,
  reportedMinute: number,
): number {
  if (phase === "SECOND_HALF" && reportedMinute < 45) return reportedMinute + 45;
  return reportedMinute;
}

export function nextCanonicalWindowStart(matchMinute: number): number {
  return Math.ceil((matchMinute + 1) / MARKET_WINDOW_MINUTES) * MARKET_WINDOW_MINUTES;
}

export function canonicalMarketId(params: {
  fixtureId: string;
  type: SupportedMarketType;
  period: MarketPeriod;
  startMinute: number;
  endMinute: number;
}): string {
  return [
    "flashbets-v2",
    params.fixtureId,
    params.type.toLowerCase(),
    params.period === "FIRST_HALF" ? "h1" : "h2",
    `${params.startMinute}-${params.endMinute}`,
  ].join(":");
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1_000).toISOString();
}

function periodBounds(period: MarketPeriod): { start: number; end: number } {
  return period === "FIRST_HALF" ? { start: 0, end: 45 } : { start: 45, end: 90 };
}

export function fixtureIsFresh(
  fixture: Fixture,
  nowMs: number,
  staleAfterSeconds: number,
): boolean {
  const receivedAt = new Date(fixture.receivedAt).getTime();
  const sourceTimestamp = new Date(fixture.sourceTimestamp).getTime();
  return (
    Number.isFinite(receivedAt) &&
    Number.isFinite(sourceTimestamp) &&
    nowMs >= receivedAt &&
    nowMs >= sourceTimestamp &&
    nowMs - receivedAt <= staleAfterSeconds * 1_000 &&
    nowMs - sourceTimestamp <= staleAfterSeconds * 1_000
  );
}

export function eventCount(
  fixture: Fixture,
  type: SupportedMarketType,
): number | null {
  return type === "GOAL" ? fixture.goals : fixture.corners;
}

export function snapshotFromFixture(fixture: Fixture, capturedAt: string): TxLineSnapshot | null {
  if (
    fixture.goals === null ||
    fixture.corners === null ||
    !fixture.complete ||
    !fixture.sourceTimestampTrusted
  ) {
    return null;
  }
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

export function deriveCanonicalMarkets(
  fixture: Fixture,
  config: MarketPolicyConfig,
): Market[] {
  const period = periodForPhase(fixture.phase);
  if (
    !period ||
    !fixture.complete ||
    !fixture.sourceTimestampTrusted ||
    !fixtureIsFresh(fixture, config.nowMs, config.staleAfterSeconds)
  ) {
    return [];
  }

  const firstWindow = nextCanonicalWindowStart(fixture.matchMinute);
  const count = Math.max(
    1,
    Math.ceil(config.marketLeadMinutes / MARKET_WINDOW_MINUTES),
  );
  const bounds = periodBounds(period);
  const markets: Market[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const startMinute = firstWindow + offset * MARKET_WINDOW_MINUTES;
    const endMinute = startMinute + MARKET_WINDOW_MINUTES;
    if (startMinute < bounds.start || endMinute > bounds.end) continue;

    const startsAt = addSeconds(
      fixture.sourceTimestamp,
      startMinute * 60 - fixture.matchSecond,
    );
    const endsAt = addSeconds(startsAt, MARKET_WINDOW_MINUTES * 60);
    const locksAt = addSeconds(startsAt, -MARKET_LOCK_SECONDS);
    const opensAt = addSeconds(startsAt, -config.marketLeadMinutes * 60);
    const settlesAt = addSeconds(endsAt, config.settlementDelaySeconds);

    for (const type of MARKET_TYPES) {
      if (eventCount(fixture, type) === null) continue;
      const marketId = canonicalMarketId({
        fixtureId: fixture.fixtureId,
        type,
        period,
        startMinute,
        endMinute,
      });
      markets.push({
        marketId,
        fixtureId: fixture.fixtureId,
        type,
        period,
        startMinute,
        endMinute,
        opensAt,
        locksAt,
        startsAt,
        endsAt,
        settlesAt,
        settlementDelaySeconds: config.settlementDelaySeconds,
        status: "CREATED",
        openingSnapshot: null,
        closingSnapshot: null,
        result: null,
        settlementReceiptId: null,
        question: marketQuestion(type),
        source: fixture.source,
        sourceMode: fixture.sourceMode ?? "LIVE",
        replayId: fixture.replayId ?? null,
        replayRunId: fixture.replayRunId ?? null,
        createdAt: fixture.receivedAt,
        updatedAt: fixture.receivedAt,
      });
    }
  }
  return markets;
}

export function projectedLifecycleStatus(market: Market, nowMs: number): MarketStatus {
  if (market.status === "SETTLED" || market.status === "VOID") return market.status;
  if (nowMs >= new Date(market.endsAt).getTime()) return "WAITING_FOR_SETTLEMENT";
  if (nowMs >= new Date(market.locksAt).getTime()) return "LOCKED";
  if (nowMs >= new Date(market.opensAt).getTime()) return "OPEN";
  return "CREATED";
}

export function canTransitionMarket(from: MarketStatus, to: MarketStatus): boolean {
  if (from === to) return true;
  if (from === "SETTLED" || from === "VOID") return false;
  if (to === "VOID") return true;
  return STATUS_ORDER.indexOf(to) > STATUS_ORDER.indexOf(from);
}
