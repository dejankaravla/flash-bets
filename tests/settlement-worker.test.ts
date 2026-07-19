import assert from "node:assert/strict";
import test from "node:test";

import { createSettlementWorker } from "../lib/server/settlement-worker.ts";

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempts = 0; attempts < 100; attempts += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("worker did not reach the expected state");
}

test("the settlement worker runs immediately, sleeps, repeats, and stops without overlap", async () => {
  let cycles = 0;
  let scheduled: (() => void) | null = null;
  const worker = createSettlementWorker({
    intervalMs: 250,
    now: () => 123_456,
    run: async (nowMs) => {
      assert.equal(nowMs, 123_456);
      cycles += 1;
      return { lifecycleTransitions: 0, dueMarkets: 0, settled: 0, voided: 0, receipts: [], errors: [] };
    },
    schedule: (callback, delayMs) => {
      assert.equal(delayMs, 250);
      scheduled = callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    cancel: () => { scheduled = null; },
  });
  worker.start();
  await waitFor(() => cycles === 1 && scheduled !== null);
  assert.equal(cycles, 1);
  assert.ok(scheduled);
  const next = scheduled as () => void;
  scheduled = null;
  next();
  await waitFor(() => cycles === 2 && scheduled !== null);
  assert.equal(cycles, 2);
  worker.stop();
  assert.equal(worker.isRunning(), false);
  assert.equal(scheduled, null);
});
