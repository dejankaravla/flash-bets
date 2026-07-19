import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { Keypair } from "@solana/web3.js";

import { flashBetsMode } from "../lib/app-mode.ts";
import { ReplayEngine } from "../lib/replay/replay-engine.ts";
import type { ReplayDataset } from "../lib/replay/types.ts";
import { disconnectMongo } from "../lib/server/db/mongoose.ts";
import { readFlashPointsAccount } from "../lib/server/flashpoints-service.ts";
import { ingestTxLineScores } from "../lib/server/market-service.ts";
import { placePrediction, listPredictionsForWallet } from "../lib/server/prediction-service.ts";
import { listMarketsForFixture } from "../lib/server/repositories/market-repository.ts";
import { clearFlashBetsCollections } from "../lib/server/repositories/test-repository.ts";
import { listReplayDatasets, loadReplayDataset } from "../lib/server/replay/replay-loader.ts";
import { runSettlement } from "../lib/server/settlement-service.ts";
import { controlReplay, listReplayDashboardFixtures, selectReplay } from "../lib/server/replay/replay-service.ts";

beforeEach(clearFlashBetsCollections);
after(disconnectMongo);

interface ScheduledJob {
  callback: () => void;
  delayMs: number;
}

function engineHarness(dataset: ReplayDataset, emit: ConstructorParameters<typeof ReplayEngine>[0]["emit"]) {
  let wallMs = 0;
  let job: ScheduledJob | null = null;
  const engine = new ReplayEngine({
    dataset,
    runId: "test-run",
    fixtureId: 9_123_456_789,
    virtualEpochMs: 1_800_000_000_000,
    emit,
    wallNow: () => wallMs,
    schedule: (callback, delayMs) => {
      job = { callback, delayMs };
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    cancel: () => { job = null; },
  });
  return {
    engine,
    next: async () => {
      const current = job as ScheduledJob | null;
      assert.ok(current, "a replay frame should be scheduled");
      job = null;
      wallMs += current.delayMs;
      current.callback();
      for (let attempts = 0; attempts < 100 && !job && engine.getState().status !== "FINISHED"; attempts += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    },
    scheduled: () => job,
    advanceWall: (milliseconds: number) => { wallMs += milliseconds; },
  };
}

test("mode selection is configuration-only and defaults safely to LIVE", () => {
  assert.equal(flashBetsMode(undefined), "LIVE");
  assert.equal(flashBetsMode("live"), "LIVE");
  assert.equal(flashBetsMode("REPLAY"), "REPLAY");
  assert.equal(flashBetsMode("unexpected"), "LIVE");
});

test("external replay datasets load in one normalized format and are chronological", async () => {
  const datasets = await listReplayDatasets();
  assert.ok(datasets.length >= 2);
  for (const dataset of datasets) {
    assert.equal(dataset.version, 1);
    assert.equal(dataset.timeline[0]?.atMs, 0);
    assert.ok(dataset.timeline.every((entry, index) => index === 0 || entry.atMs > dataset.timeline[index - 1]!.atMs));
    assert.ok(dataset.timeline.every((entry) => entry.update.sourceTimestampTrusted && entry.update.isComplete));
  }
});

test("ReplayEngine honors pause, resume, deterministic speed, and completion", async () => {
  const dataset = await loadReplayDataset("world-cup-brazil-argentina");
  const emitted: number[] = [];
  const harness = engineHarness(dataset, (_update, virtualNowMs) => { emitted.push(virtualNowMs); });
  await harness.engine.initialize();
  assert.equal(harness.engine.getState().status, "PAUSED");
  assert.equal(emitted.length, 1);
  harness.engine.play();
  assert.equal(harness.scheduled()?.delayMs, dataset.frameIntervalMs);
  harness.advanceWall(500);
  const paused = harness.engine.pause();
  assert.equal(paused.currentTimeMs, 500);
  harness.engine.setSpeed(10);
  harness.engine.play();
  assert.equal(harness.scheduled()?.delayMs, (dataset.frameIntervalMs - 500) / 10);
  while (harness.engine.getState().status !== "FINISHED") await harness.next();
  const finished = harness.engine.getState();
  assert.equal(finished.currentTimeMs, dataset.durationMs);
  assert.equal(finished.progress, 1);
  assert.ok(emitted.length > 40);
});

test("replay updates drive the real market and automatic settlement path to a receipt", async () => {
  const dataset = await loadReplayDataset("world-cup-brazil-argentina");
  const fixtureId = 9_123_456_789;
  const epoch = 1_800_000_000_000;
  const harness = engineHarness(dataset, async (update, virtualNowMs) => {
    await ingestTxLineScores(update, virtualNowMs, {
      sourceMode: "REPLAY",
      sourceLabel: `Replay:${dataset.id}`,
      replayId: dataset.id,
      replayRunId: "test-run",
    });
    await runSettlement(virtualNowMs);
  });
  await harness.engine.initialize();
  const goalMarket = (await listMarketsForFixture(String(fixtureId))).find((market) => market.type === "GOAL");
  assert.ok(goalMarket);
  assert.equal(goalMarket.status, "OPEN");
  assert.equal(goalMarket.sourceMode, "REPLAY");

  const wallet = Keypair.generate().publicKey.toBase58();
  await placePrediction({ wallet, marketId: goalMarket.marketId, side: "YES", amount: 100, nowMs: epoch });
  harness.engine.setSpeed(10);
  harness.engine.play();
  while (harness.engine.getState().status !== "FINISHED") await harness.next();

  const [prediction] = await listPredictionsForWallet(wallet);
  assert.equal(prediction?.status, "WON");
  assert.equal(prediction?.market?.sourceMode, "REPLAY");
  assert.equal(prediction?.receipt?.winningSide, "YES");
  assert.equal(prediction?.receipt?.calculatedDelta, 1);
  assert.ok(prediction?.receipt?.txLineOpeningTimestamp);
  assert.ok(prediction?.receipt?.txLineClosingTimestamp);
  assert.equal((await readFlashPointsAccount(wallet))?.locked, 0);

  const dashboard = await listReplayDashboardFixtures();
  assert.ok(dashboard.some((fixture) => fixture.replayId === dataset.id && fixture.segment === "replay"));
  const finishedRun = dashboard.find((fixture) => fixture.id === fixtureId && fixture.segment === "finished");
  assert.equal(finishedRun?.replayStatus, "FINISHED");
  assert.deepEqual([finishedRun?.homeScore, finishedRun?.awayScore], dataset.fixture.finalScore);
});

test("replay restart voids and refunds an unfinished standalone prediction", async () => {
  const previousMode = process.env.FLASHBETS_MODE;
  process.env.FLASHBETS_MODE = "REPLAY";
  try {
    const first = await selectReplay("world-cup-brazil-argentina");
    const goalMarket = (await listMarketsForFixture(String(first.fixtureId))).find((market) => market.type === "GOAL");
    assert.ok(goalMarket);
    const wallet = Keypair.generate().publicKey.toBase58();
    await placePrediction({
      wallet,
      marketId: goalMarket.marketId,
      side: "YES",
      amount: 100,
      nowMs: first.virtualNowMs,
    });
    const restarted = await controlReplay({ action: "RESTART" });
    assert.notEqual(restarted.fixtureId, first.fixtureId);
    assert.equal(restarted.status, "PAUSED");
    const [prediction] = await listPredictionsForWallet(wallet);
    assert.equal(prediction?.status, "VOID");
    assert.equal(prediction?.refund, 100);
    assert.equal(prediction?.receipt?.settlementReason, "FIXTURE_ABANDONED_OR_CANCELLED");
    assert.deepEqual(
      { available: (await readFlashPointsAccount(wallet))?.available, locked: (await readFlashPointsAccount(wallet))?.locked },
      { available: 1_000, locked: 0 },
    );
  } finally {
    if (previousMode === undefined) delete process.env.FLASHBETS_MODE;
    else process.env.FLASHBETS_MODE = previousMode;
  }
});
