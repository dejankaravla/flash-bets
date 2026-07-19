import "server-only";

import { applicationNowMs } from "@/lib/server/application-clock";
import { runSettlement, type SettlementRunResult } from "@/lib/server/settlement-service";

type Timer = ReturnType<typeof setTimeout>;

export interface SettlementWorkerOptions {
  intervalMs?: number;
  now?: () => number;
  run?: (nowMs: number) => Promise<SettlementRunResult>;
  schedule?: (callback: () => void, delayMs: number) => Timer;
  cancel?: (timer: Timer) => void;
  onResult?: (result: SettlementRunResult) => void;
  onError?: (error: unknown) => void;
}

export interface SettlementWorker {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export function createSettlementWorker(options: SettlementWorkerOptions = {}): SettlementWorker {
  const configuredInterval = Number(process.env.SETTLEMENT_WORKER_INTERVAL_MS);
  const intervalMs = options.intervalMs ?? (
    Number.isInteger(configuredInterval) && configuredInterval >= 10
      ? configuredInterval
      : 1_000
  );
  const now = options.now ?? applicationNowMs;
  const run = options.run ?? runSettlement;
  const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const cancel = options.cancel ?? clearTimeout;
  let running = false;
  let timer: Timer | null = null;
  let inFlight = false;

  const queue = () => {
    if (!running || timer) return;
    timer = schedule(() => {
      timer = null;
      void tick();
    }, intervalMs);
  };

  const tick = async () => {
    if (!running || inFlight) return;
    inFlight = true;
    try {
      const result = await run(now());
      options.onResult?.(result);
    } catch (error) {
      (options.onError ?? ((reason) => console.error(
        "[SettlementWorker] cycle failed",
        reason instanceof Error ? { name: reason.name } : { name: "UnknownError" },
      )))(error);
    } finally {
      inFlight = false;
      queue();
    }
  };

  return {
    start() {
      if (running) return;
      running = true;
      void tick();
    },
    stop() {
      running = false;
      if (timer) cancel(timer);
      timer = null;
    },
    isRunning: () => running,
  };
}

const globalWorker = globalThis as typeof globalThis & {
  __flashBetsSettlementWorker?: SettlementWorker;
};

export function startSettlementWorker(): SettlementWorker {
  globalWorker.__flashBetsSettlementWorker ??= createSettlementWorker();
  globalWorker.__flashBetsSettlementWorker.start();
  return globalWorker.__flashBetsSettlementWorker;
}
