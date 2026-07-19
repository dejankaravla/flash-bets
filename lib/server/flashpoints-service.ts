import "server-only";

import type { ClientSession } from "mongoose";

import type { FlashPointsAccount } from "@/lib/domain/flash-bets";
import {
  ensureWalletAccount,
  findWalletAccount,
} from "@/lib/server/repositories/wallet-account-repository";

export const INITIAL_FLASHPOINTS = 1_000;

export function newFlashPointsAccount(wallet: string, now: string): FlashPointsAccount {
  return {
    wallet,
    available: INITIAL_FLASHPOINTS,
    locked: 0,
    won: 0,
    lost: 0,
    refunded: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureFlashPointsAccount(
  wallet: string,
  session?: ClientSession,
  now = new Date().toISOString(),
): Promise<FlashPointsAccount> {
  return ensureWalletAccount(newFlashPointsAccount(wallet, now), session);
}

export function readFlashPointsAccount(wallet: string): Promise<FlashPointsAccount | null> {
  return findWalletAccount(wallet);
}
