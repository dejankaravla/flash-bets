import assert from "node:assert/strict";
import test from "node:test";

import { normalizeScoresUpdate } from "../lib/txline-normalize";
import { STAT_KEY } from "../lib/types/txline";

test("scheduled and unknown source states never normalize as in-play", () => {
  const scheduled = normalizeScoresUpdate(
    { FixtureId: 1, Seq: 1, Ts: 1_750_000_000_000, GameState: "scheduled" },
    ["A", "B"],
  );
  const unknown = normalizeScoresUpdate(
    { FixtureId: 1, Seq: 2, Ts: 1_750_000_001_000, GameState: "mystery" },
    ["A", "B"],
  );
  assert.equal(scheduled?.matchPhase, "NOT_STARTED");
  assert.equal(unknown?.matchPhase, "UNKNOWN");
});

test("verified live goal and corner counters preserve completeness", () => {
  const update = normalizeScoresUpdate(
    {
      FixtureId: 1,
      Seq: 9,
      Ts: 1_750_000_000_000,
      GameState: "H1",
      DataSoccer: { Minutes: 12 },
      ScoreSoccer: {
        Participant1: { Total: { Goals: 1 } },
        Participant2: { Total: { Goals: 0 } },
      },
      Stats: {
        [String(STAT_KEY.P1_CORNERS)]: 2,
        [String(STAT_KEY.P2_CORNERS)]: 1,
      },
    },
    ["A", "B"],
  );
  assert.equal(update?.matchPhase, "FIRST_HALF");
  assert.equal(update?.matchMinute, 12);
  assert.equal(update?.stats[STAT_KEY.P1_GOALS], 1);
  assert.equal(update?.stats[STAT_KEY.P1_CORNERS], 2);
  assert.equal(update?.sourceTimestampTrusted, true);
  assert.equal(update?.isComplete, true);
});

test("missing upstream timestamp is marked untrusted", () => {
  const update = normalizeScoresUpdate(
    { FixtureId: 1, Seq: 9, GameState: "H1", Stats: {} },
    ["A", "B"],
  );
  assert.equal(update?.sourceTimestampTrusted, false);
  assert.equal(update?.isComplete, false);
});
