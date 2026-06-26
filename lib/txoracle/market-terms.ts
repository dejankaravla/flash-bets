import { BN } from "@coral-xyz/anchor";

import type { MicroMarket } from "@/lib/micro-markets";
import { GAME_PHASE, STAT_KEY } from "@/lib/types/txline";

export interface MarketIntentParams {
  fixtureId: number;
  period: number;
  statAKey: number;
  statBKey: number | null;
  predicate: {
    threshold: number;
    comparison: {
      greaterThan?: Record<string, never>;
      lessThan?: Record<string, never>;
      equalTo?: Record<string, never>;
    };
  };
  op: { add?: Record<string, never>; subtract?: Record<string, never> } | null;
  negation: boolean;
}

interface PropositionSpec {
  statAKey: number;
  statBKey: number | null;
  op: MarketIntentParams["op"];
  threshold: number;
}

const PROPOSITION_SPECS: Record<string, PropositionSpec> = {
  "Total Corners > 1.5": {
    statAKey: STAT_KEY.P1_CORNERS,
    statBKey: STAT_KEY.P2_CORNERS,
    op: { add: {} },
    threshold: 1,
  },
  "Total Goals > 0.5": {
    statAKey: STAT_KEY.P1_GOALS,
    statBKey: STAT_KEY.P2_GOALS,
    op: { add: {} },
    threshold: 0,
  },
  "Total Fouls > 3.5": {
    statAKey: STAT_KEY.P1_YELLOW,
    statBKey: STAT_KEY.P2_YELLOW,
    op: { add: {} },
    threshold: 3,
  },
  "Yellow Cards > 0.5": {
    statAKey: STAT_KEY.P1_YELLOW,
    statBKey: STAT_KEY.P2_YELLOW,
    op: { add: {} },
    threshold: 0,
  },
  "Shots on Target > 2.5": {
    statAKey: STAT_KEY.P1_GOALS,
    statBKey: STAT_KEY.P2_GOALS,
    op: { add: {} },
    threshold: 2,
  },
  "Offsides > 1.5": {
    statAKey: STAT_KEY.P1_CORNERS,
    statBKey: STAT_KEY.P2_CORNERS,
    op: { add: {} },
    threshold: 1,
  },
};

function gamePhaseToPeriod(gameState: number): number {
  if (gameState === GAME_PHASE.H2 || gameState === GAME_PHASE.F) {
    return GAME_PHASE.H2;
  }
  return GAME_PHASE.H1;
}

export function buildMarketIntentParams(
  fixtureId: number,
  market: MicroMarket,
  gameState: number,
  selection: "yes" | "no",
): MarketIntentParams {
  const spec = PROPOSITION_SPECS[market.proposition] ?? {
    statAKey: STAT_KEY.P1_GOALS,
    statBKey: STAT_KEY.P2_GOALS,
    op: { add: {} },
    threshold: 0,
  };

  return {
    fixtureId,
    period: gamePhaseToPeriod(gameState),
    statAKey: spec.statAKey,
    statBKey: spec.statBKey,
    predicate: {
      threshold: spec.threshold,
      comparison: { greaterThan: {} },
    },
    op: spec.op,
    negation: selection === "no",
  };
}

export function toAnchorMarketIntentParams(params: MarketIntentParams) {
  return {
    fixtureId: new BN(params.fixtureId),
    period: params.period,
    statAKey: params.statAKey,
    statBKey: params.statBKey,
    predicate: {
      threshold: params.predicate.threshold,
      comparison: params.predicate.comparison,
    },
    op: params.op,
    negation: params.negation,
  };
}
