import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalMarketId,
  deriveCanonicalMarkets,
  fixtureIsFresh,
  nextCanonicalWindowStart,
  projectedLifecycleStatus,
} from "../lib/market-policy.ts";
import { fixtureAt } from "./helpers.ts";

test("canonical windows and Prompt 1 IDs remain deterministic", () => {
  assert.equal(nextCanonicalWindowStart(32), 35);
  assert.equal(
    canonicalMarketId({
      fixtureId: "20260001",
      type: "GOAL",
      period: "FIRST_HALF",
      startMinute: 35,
      endMinute: 40,
    }),
    "flashbets-v2:20260001:goal:h1:35-40",
  );
});

test("only Goal and Corner markets are generated with correction-delay timestamps", () => {
  const nowMs = new Date("2026-07-18T18:00:00.000Z").getTime();
  const fixture = fixtureAt(nowMs);
  const markets = deriveCanonicalMarkets(fixture, {
    marketLeadMinutes: 15,
    staleAfterSeconds: 45,
    settlementDelaySeconds: 120,
    nowMs,
  });
  assert.equal(markets.length, 4);
  assert.deepEqual(new Set(markets.map((market) => market.type)), new Set(["GOAL", "CORNER"]));
  assert.equal(markets[0]?.startMinute, 35);
  assert.equal(
    new Date(markets[0]!.settlesAt).getTime() - new Date(markets[0]!.endsAt).getTime(),
    120_000,
  );
});

test("halftime and stale fixtures cannot generate markets", () => {
  const base = new Date("2026-07-18T18:00:00.000Z").getTime();
  const config = {
    marketLeadMinutes: 15,
    staleAfterSeconds: 45,
    settlementDelaySeconds: 120,
    nowMs: base + 60_000,
  };
  assert.equal(deriveCanonicalMarkets(fixtureAt(base, { phase: "HALFTIME" }), config).length, 0);
  assert.equal(deriveCanonicalMarkets(fixtureAt(base), config).length, 0);
  assert.equal(fixtureIsFresh(fixtureAt(base), base + 60_000, 45), false);
});

test("lifecycle boundaries are inclusive at lock, close, and settlement-wait transitions", () => {
  const base = Date.now();
  const market = deriveCanonicalMarkets(fixtureAt(base), {
    marketLeadMinutes: 15,
    staleAfterSeconds: 45,
    settlementDelaySeconds: 120,
    nowMs: base,
  })[0]!;
  assert.equal(projectedLifecycleStatus(market, new Date(market.locksAt).getTime() - 1), "OPEN");
  assert.equal(projectedLifecycleStatus(market, new Date(market.locksAt).getTime()), "LOCKED");
  assert.equal(projectedLifecycleStatus(market, new Date(market.endsAt).getTime()), "WAITING_FOR_SETTLEMENT");
});
