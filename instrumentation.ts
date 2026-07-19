export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSettlementWorker } = await import("@/lib/server/settlement-worker");
    startSettlementWorker();
  }
}

