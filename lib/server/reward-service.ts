import "server-only";

import type {
  Prediction,
  PredictionSelection,
  SettlementAward,
} from "@/lib/domain/flash-bets";

export interface PoolDistribution {
  totalPool: number;
  winningPool: number;
  remainder: number;
  awards: SettlementAward[];
}

function safeNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return Number(value);
}

export function distributePool(
  predictions: Prediction[],
  winningSide: PredictionSelection,
): PoolDistribution {
  const unsettled = predictions.filter(
    (prediction) => prediction.status === "PENDING" || prediction.status === "LOCKED",
  );
  const totalPoolBig = unsettled.reduce((total, prediction) => total + BigInt(prediction.amount), 0n);
  const winners = unsettled
    .filter((prediction) => prediction.side === winningSide)
    .sort((left, right) => left.predictionId.localeCompare(right.predictionId));
  const winningPoolBig = winners.reduce(
    (total, prediction) => total + BigInt(prediction.amount),
    0n,
  );
  if (winningPoolBig === 0n) {
    return {
      totalPool: safeNumber(totalPoolBig, "Total pool"),
      winningPool: 0,
      remainder: safeNumber(totalPoolBig, "Remainder"),
      awards: [],
    };
  }

  const rewards = new Map<string, bigint>();
  let distributed = 0n;
  for (const winner of winners) {
    const reward = (totalPoolBig * BigInt(winner.amount)) / winningPoolBig;
    rewards.set(winner.predictionId, reward);
    distributed += reward;
  }
  const remainderBig = totalPoolBig - distributed;
  for (let index = 0n; index < remainderBig; index += 1n) {
    const winner = winners[Number(index)];
    if (!winner) throw new Error("Remainder exceeds winner count");
    rewards.set(winner.predictionId, (rewards.get(winner.predictionId) ?? 0n) + 1n);
  }

  return {
    totalPool: safeNumber(totalPoolBig, "Total pool"),
    winningPool: safeNumber(winningPoolBig, "Winning pool"),
    remainder: safeNumber(remainderBig, "Remainder"),
    awards: unsettled.map((prediction) => {
      const won = prediction.side === winningSide;
      return {
        predictionId: prediction.predictionId,
        wallet: prediction.wallet,
        side: prediction.side,
        amount: prediction.amount,
        reward: won
          ? safeNumber(rewards.get(prediction.predictionId) ?? 0n, "Reward")
          : 0,
        refund: 0,
        status: won ? "WON" : "LOST",
      };
    }),
  };
}

export function refundPool(predictions: Prediction[]): PoolDistribution {
  const unsettled = predictions.filter(
    (prediction) => prediction.status === "PENDING" || prediction.status === "LOCKED",
  );
  const totalPool = unsettled.reduce((total, prediction) => {
    const next = total + prediction.amount;
    if (!Number.isSafeInteger(next)) throw new Error("Total pool exceeds the safe integer range");
    return next;
  }, 0);
  return {
    totalPool,
    winningPool: 0,
    remainder: 0,
    awards: unsettled.map((prediction) => ({
      predictionId: prediction.predictionId,
      wallet: prediction.wallet,
      side: prediction.side,
      amount: prediction.amount,
      reward: 0,
      refund: prediction.amount,
      status: "VOID",
    })),
  };
}
