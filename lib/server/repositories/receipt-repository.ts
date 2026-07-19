import "server-only";

import type { ClientSession } from "mongoose";

import type { SettlementReceipt } from "@/lib/domain/flash-bets";
import { connectMongo } from "@/lib/server/db/mongoose";
import { SettlementReceiptModel } from "@/lib/server/db/models";
import { toDomain } from "@/lib/server/repositories/repository-utils";

export async function createReceipt(
  receipt: SettlementReceipt,
  session?: ClientSession,
): Promise<SettlementReceipt> {
  await connectMongo();
  try {
    const saved = await SettlementReceiptModel.findOneAndUpdate(
      { marketId: receipt.marketId },
      { $setOnInsert: receipt },
      { upsert: true, new: true, session, lean: true },
    );
    return toDomain<SettlementReceipt>(saved);
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const existing = await findReceiptByMarket(receipt.marketId, session);
    if (!existing) throw error;
    return existing;
  }
}

export async function findReceiptByMarket(
  marketId: string,
  session?: ClientSession,
): Promise<SettlementReceipt | null> {
  await connectMongo();
  const receipt = await SettlementReceiptModel.findOne({ marketId })
    .session(session ?? null)
    .lean();
  return receipt ? toDomain<SettlementReceipt>(receipt) : null;
}

export async function findReceiptsByIds(receiptIds: string[]): Promise<SettlementReceipt[]> {
  if (receiptIds.length === 0) return [];
  await connectMongo();
  const receipts = await SettlementReceiptModel.find({ receiptId: { $in: receiptIds } }).lean();
  return receipts.map((receipt) => toDomain<SettlementReceipt>(receipt));
}

export async function upsertReceiptForMigration(
  receipt: SettlementReceipt,
  session?: ClientSession,
): Promise<void> {
  await connectMongo();
  await SettlementReceiptModel.updateOne(
    { receiptId: receipt.receiptId },
    { $set: receipt },
    { upsert: true, session },
  );
}

export async function countReceipts(session?: ClientSession): Promise<number> {
  await connectMongo();
  return SettlementReceiptModel.countDocuments({}).session(session ?? null);
}
