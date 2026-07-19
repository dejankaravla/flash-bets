import "server-only";

import type { ClientSession } from "mongoose";

import type { Prediction, PredictionStatus } from "@/lib/domain/flash-bets";
import { connectMongo } from "@/lib/server/db/mongoose";
import { PredictionModel } from "@/lib/server/db/models";
import { toDomain } from "@/lib/server/repositories/repository-utils";

export async function createPrediction(
  prediction: Prediction,
  session?: ClientSession,
): Promise<Prediction> {
  await connectMongo();
  const [created] = await PredictionModel.create([prediction], session ? { session } : undefined);
  return toDomain<Prediction>(created.toObject());
}

export async function deletePredictionReservation(
  predictionId: string,
  session?: ClientSession,
): Promise<boolean> {
  await connectMongo();
  const result = await PredictionModel.deleteOne(
    {
      predictionId,
      status: { $in: ["PENDING", "LOCKED"] },
      settlementReceiptId: null,
    },
    { session },
  );
  return result.deletedCount === 1;
}

export async function findPrediction(
  predictionId: string,
  session?: ClientSession,
): Promise<Prediction | null> {
  await connectMongo();
  const prediction = await PredictionModel.findOne({ predictionId })
    .session(session ?? null)
    .lean();
  return prediction ? toDomain<Prediction>(prediction) : null;
}

export async function listPredictionsForWalletRecord(wallet: string): Promise<Prediction[]> {
  await connectMongo();
  const predictions = await PredictionModel.find({ wallet }).sort({ createdAt: -1 }).lean();
  return predictions.map((prediction) => toDomain<Prediction>(prediction));
}

export async function listPredictionsForMarket(
  marketId: string,
  session?: ClientSession,
): Promise<Prediction[]> {
  await connectMongo();
  const predictions = await PredictionModel.find({ marketId })
    .sort({ predictionId: 1 })
    .session(session ?? null)
    .lean();
  return predictions.map((prediction) => toDomain<Prediction>(prediction));
}

export async function markPredictionsLocked(
  marketId: string,
  updatedAt: string,
  session?: ClientSession,
): Promise<void> {
  await connectMongo();
  await PredictionModel.updateMany(
    { marketId, status: "PENDING" },
    { $set: { status: "LOCKED", updatedAt } },
    { session },
  );
}

export async function finalizePrediction(input: {
  predictionId: string;
  status: Extract<PredictionStatus, "WON" | "LOST" | "VOID">;
  settlementReceiptId: string;
  reward: number;
  refund: number;
  settledAt: string;
  session?: ClientSession;
}): Promise<Prediction | null> {
  await connectMongo();
  const prediction = await PredictionModel.findOneAndUpdate(
    {
      predictionId: input.predictionId,
      $or: [
        { status: { $in: ["PENDING", "LOCKED"] }, settlementReceiptId: null },
        { status: input.status, settlementReceiptId: input.settlementReceiptId },
      ],
    },
    {
      $set: {
        status: input.status,
        settlementReceiptId: input.settlementReceiptId,
        reward: input.reward,
        refund: input.refund,
        settledAt: input.settledAt,
        updatedAt: input.settledAt,
      },
    },
    { new: true, session: input.session, lean: true },
  );
  return prediction ? toDomain<Prediction>(prediction) : null;
}

export async function upsertPredictionForMigration(
  prediction: Prediction,
  session?: ClientSession,
): Promise<void> {
  await connectMongo();
  await PredictionModel.updateOne(
    { predictionId: prediction.predictionId },
    { $set: prediction },
    { upsert: true, session },
  );
}
