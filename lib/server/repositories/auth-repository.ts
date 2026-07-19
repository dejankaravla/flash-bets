import "server-only";

import type { ClientSession } from "mongoose";

import type { WalletChallenge, WalletSession } from "@/lib/domain/flash-bets";
import { connectMongo } from "@/lib/server/db/mongoose";
import { WalletChallengeModel, WalletSessionModel } from "@/lib/server/db/models";
import { toDomain } from "@/lib/server/repositories/repository-utils";

export async function createChallenge(
  challenge: WalletChallenge,
  session?: ClientSession,
): Promise<void> {
  await connectMongo();
  await WalletChallengeModel.updateMany(
    { wallet: challenge.wallet, usedAt: null },
    { $set: { usedAt: challenge.createdAt } },
    { session },
  );
  await WalletChallengeModel.create([challenge], session ? { session } : undefined);
}

export async function findChallenge(
  challengeId: string,
  session?: ClientSession,
): Promise<WalletChallenge | null> {
  await connectMongo();
  const challenge = await WalletChallengeModel.findOne({ challengeId }).session(session ?? null).lean();
  return challenge ? toDomain<WalletChallenge>(challenge) : null;
}

export async function consumeChallenge(
  challengeId: string,
  usedAt: string,
  session?: ClientSession,
): Promise<boolean> {
  await connectMongo();
  const result = await WalletChallengeModel.updateOne(
    { challengeId, usedAt: null },
    { $set: { usedAt } },
    { session },
  );
  return result.modifiedCount === 1;
}

export async function createSession(
  walletSession: WalletSession,
  session?: ClientSession,
): Promise<void> {
  await connectMongo();
  await WalletSessionModel.create([walletSession], session ? { session } : undefined);
  await WalletSessionModel.updateMany(
    {
      wallet: walletSession.wallet,
      tokenHash: { $ne: walletSession.tokenHash },
      revokedAt: null,
    },
    { $set: { revokedAt: walletSession.createdAt } },
    { session },
  );
}

export async function findSession(tokenHash: string): Promise<WalletSession | null> {
  await connectMongo();
  const session = await WalletSessionModel.findOne({ tokenHash }).lean();
  return session ? toDomain<WalletSession>(session) : null;
}

export async function revokeWalletSession(tokenHash: string, revokedAt: string): Promise<void> {
  await connectMongo();
  await WalletSessionModel.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt } },
  );
}

export async function cleanupExpiredAuth(cutoff: string, session?: ClientSession): Promise<void> {
  await connectMongo();
  await WalletChallengeModel.deleteMany({ expiresAt: { $lt: cutoff } }).session(session ?? null);
  await WalletSessionModel.deleteMany({
    $or: [
      { revokedAt: { $ne: null, $lt: cutoff } },
      { revokedAt: null, expiresAt: { $lt: cutoff } },
    ],
  }).session(session ?? null);
}

export async function upsertChallengeForMigration(
  challenge: WalletChallenge,
  session?: ClientSession,
): Promise<void> {
  await connectMongo();
  await WalletChallengeModel.updateOne(
    { challengeId: challenge.challengeId },
    { $set: challenge },
    { upsert: true, session },
  );
}

export async function upsertSessionForMigration(
  walletSession: WalletSession,
  session?: ClientSession,
): Promise<void> {
  await connectMongo();
  await WalletSessionModel.updateOne(
    { tokenHash: walletSession.tokenHash },
    { $set: walletSession },
    { upsert: true, session },
  );
}
