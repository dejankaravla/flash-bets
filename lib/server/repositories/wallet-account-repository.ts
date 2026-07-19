import "server-only";

import type { ClientSession } from "mongoose";

import type { FlashPointsAccount } from "@/lib/domain/flash-bets";
import { connectMongo } from "@/lib/server/db/mongoose";
import { WalletAccountModel } from "@/lib/server/db/models";
import { toDomain } from "@/lib/server/repositories/repository-utils";

export async function findWalletAccount(
  wallet: string,
  session?: ClientSession,
): Promise<FlashPointsAccount | null> {
  await connectMongo();
  const account = await WalletAccountModel.findOne({ wallet }).session(session ?? null).lean();
  return account ? toDomain<FlashPointsAccount>(account) : null;
}

export async function ensureWalletAccount(
  account: FlashPointsAccount,
  session?: ClientSession,
): Promise<FlashPointsAccount> {
  await connectMongo();
  const saved = await WalletAccountModel.findOneAndUpdate(
    { wallet: account.wallet },
    { $setOnInsert: account },
    { upsert: true, new: true, session, lean: true },
  );
  return toDomain<FlashPointsAccount>(saved);
}

export async function lockWalletPoints(input: {
  wallet: string;
  amount: number;
  updatedAt: string;
  session?: ClientSession;
}): Promise<FlashPointsAccount | null> {
  await connectMongo();
  const saved = await WalletAccountModel.findOneAndUpdate(
    { wallet: input.wallet, available: { $gte: input.amount } },
    {
      $inc: { available: -input.amount, locked: input.amount },
      $set: { updatedAt: input.updatedAt },
    },
    { new: true, session: input.session, lean: true },
  );
  return saved ? toDomain<FlashPointsAccount>(saved) : null;
}

export async function applyWalletSettlement(input: {
  wallet: string;
  settlementReceiptId: string;
  lockedDecrease: number;
  availableIncrease: number;
  wonIncrease: number;
  lostIncrease: number;
  refundedIncrease: number;
  updatedAt: string;
  session?: ClientSession;
}): Promise<"APPLIED" | "ALREADY_APPLIED" | "FAILED"> {
  await connectMongo();
  const saved = await WalletAccountModel.findOneAndUpdate(
    {
      wallet: input.wallet,
      locked: { $gte: input.lockedDecrease },
      settlementReceiptIds: { $ne: input.settlementReceiptId },
    },
    {
      $inc: {
        locked: -input.lockedDecrease,
        available: input.availableIncrease,
        won: input.wonIncrease,
        lost: input.lostIncrease,
        refunded: input.refundedIncrease,
      },
      $addToSet: { settlementReceiptIds: input.settlementReceiptId },
      $set: { updatedAt: input.updatedAt },
    },
    { new: true, session: input.session, lean: true },
  );
  if (saved) return "APPLIED";
  const alreadyApplied = await WalletAccountModel.exists({
    wallet: input.wallet,
    settlementReceiptIds: input.settlementReceiptId,
  }).session(input.session ?? null);
  return alreadyApplied ? "ALREADY_APPLIED" : "FAILED";
}

export async function upsertWalletAccountForMigration(
  account: FlashPointsAccount,
  session?: ClientSession,
): Promise<void> {
  await connectMongo();
  await WalletAccountModel.updateOne(
    { wallet: account.wallet },
    { $set: account },
    { upsert: true, session },
  );
}

export async function countWalletAccounts(session?: ClientSession): Promise<number> {
  await connectMongo();
  return WalletAccountModel.countDocuments({}).session(session ?? null);
}
