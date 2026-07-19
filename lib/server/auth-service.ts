import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

import type {
  AuthenticatedUserView,
  WalletChallenge,
  WalletSession,
} from "@/lib/domain/flash-bets";
import { ApiError } from "@/lib/server/errors";
import { ensureFlashPointsAccount } from "@/lib/server/flashpoints-service";
import {
  cleanupExpiredAuth,
  consumeChallenge,
  createChallenge,
  createSession,
  findChallenge,
  findSession,
  revokeWalletSession,
} from "@/lib/server/repositories/auth-repository";
import { findWalletAccount } from "@/lib/server/repositories/wallet-account-repository";

export const SESSION_COOKIE_NAME = "flashbets_session";
export const DEFAULT_CHALLENGE_TTL_SECONDS = 5 * 60;
export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function envSeconds(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeWalletAddress(value: unknown): string {
  if (typeof value !== "string" || value.length > 64) {
    throw new ApiError("INVALID_WALLET", "A valid Solana wallet is required", 400);
  }
  try {
    return new PublicKey(value.trim()).toBase58();
  } catch {
    throw new ApiError("INVALID_WALLET", "A valid Solana wallet is required", 400);
  }
}

function normalizeOrigin(value: string): string {
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== value) {
      throw new Error("invalid");
    }
    return url.origin;
  } catch {
    throw new ApiError("INVALID_ORIGIN", "A valid application origin is required", 400);
  }
}

export function buildWalletSignInMessage(input: {
  wallet: string;
  origin: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}): string {
  return [
    "FlashBets wallet sign-in",
    "",
    `Wallet: ${input.wallet}`,
    `Origin: ${input.origin}`,
    "Purpose: Authenticate your FlashBets profile. This signature is for sign-in only.",
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expiresAt}`,
  ].join("\n");
}

function cleanupCutoff(nowMs: number): string {
  return new Date(nowMs - 24 * 60 * 60 * 1_000).toISOString();
}

async function cleanupExpiredAuthBestEffort(nowMs: number): Promise<void> {
  try {
    await cleanupExpiredAuth(cleanupCutoff(nowMs));
  } catch {
    console.warn("[AuthService] expired authentication cleanup was skipped");
  }
}

export async function createWalletChallenge(
  walletInput: unknown,
  requestOrigin: string,
  nowMs = Date.now(),
): Promise<WalletChallenge> {
  const wallet = normalizeWalletAddress(walletInput);
  const origin = normalizeOrigin(requestOrigin);
  const challengeId = randomBytes(18).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const issuedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(
    nowMs + envSeconds("FLASHBETS_CHALLENGE_TTL_SECONDS", DEFAULT_CHALLENGE_TTL_SECONDS) * 1_000,
  ).toISOString();
  const challenge: WalletChallenge = {
    challengeId,
    wallet,
    origin,
    nonce,
    message: buildWalletSignInMessage({ wallet, origin, nonce, issuedAt, expiresAt }),
    createdAt: issuedAt,
    expiresAt,
    usedAt: null,
  };

  await cleanupExpiredAuthBestEffort(nowMs);
  await createChallenge(challenge);
  return challenge;
}

function decodeSignature(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length < 32 || value.length > 128) {
    throw new ApiError("INVALID_SIGNATURE", "Wallet signature is invalid", 401);
  }
  try {
    const decoded = bs58.decode(value);
    if (decoded.length !== nacl.sign.signatureLength) throw new Error("length");
    return decoded;
  } catch {
    throw new ApiError("INVALID_SIGNATURE", "Wallet signature is invalid", 401);
  }
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface VerifiedWalletSession {
  token: string;
  user: AuthenticatedUserView;
}

export async function verifyWalletChallenge(input: {
  challengeId: unknown;
  wallet: unknown;
  signature: unknown;
  origin: string;
  nowMs?: number;
}): Promise<VerifiedWalletSession> {
  if (typeof input.challengeId !== "string" || input.challengeId.length > 64) {
    throw new ApiError("INVALID_CHALLENGE", "Wallet challenge is invalid", 400);
  }
  const wallet = normalizeWalletAddress(input.wallet);
  const origin = normalizeOrigin(input.origin);
  const signature = decodeSignature(input.signature);
  const nowMs = input.nowMs ?? Date.now();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);

  await cleanupExpiredAuthBestEffort(nowMs);
  const challenge = await findChallenge(input.challengeId as string);
  if (!challenge || challenge.wallet !== wallet || challenge.origin !== origin) {
    throw new ApiError("INVALID_CHALLENGE", "Wallet challenge is invalid", 401);
  }
  if (challenge.usedAt !== null) {
    throw new ApiError("CHALLENGE_USED", "Wallet challenge has already been used", 401);
  }
  if (new Date(challenge.expiresAt).getTime() <= nowMs) {
    throw new ApiError("CHALLENGE_EXPIRED", "Wallet challenge has expired", 401);
  }
  const verified = nacl.sign.detached.verify(
    new TextEncoder().encode(challenge.message),
    signature,
    new PublicKey(wallet).toBytes(),
  );
  if (!verified) {
    throw new ApiError("INVALID_SIGNATURE", "Wallet signature is invalid", 401);
  }

  const now = new Date(nowMs).toISOString();
  const flashPoints = await ensureFlashPointsAccount(wallet, undefined, now);
  if (!(await consumeChallenge(challenge.challengeId, now))) {
    throw new ApiError("CHALLENGE_USED", "Wallet challenge has already been used", 401);
  }
  const expiresAt = new Date(
    nowMs + envSeconds("FLASHBETS_SESSION_TTL_SECONDS", DEFAULT_SESSION_TTL_SECONDS) * 1_000,
  ).toISOString();
  const walletSession: WalletSession = {
    tokenHash,
    wallet,
    createdAt: now,
    expiresAt,
    revokedAt: null,
  };
  await createSession(walletSession);
  const user = { wallet, flashPoints, sessionExpiresAt: expiresAt };

  return { token, user };
}

export async function readAuthenticatedUser(
  token: string | undefined,
  nowMs = Date.now(),
): Promise<AuthenticatedUserView | null> {
  if (!token || token.length > 128) return null;
  const walletSession = await findSession(hashSessionToken(token));
  if (
    !walletSession ||
    walletSession.revokedAt !== null ||
    new Date(walletSession.expiresAt).getTime() <= nowMs
  ) {
    return null;
  }
  const flashPoints = await findWalletAccount(walletSession.wallet);
  if (!flashPoints) return null;
  return {
    wallet: walletSession.wallet,
    flashPoints,
    sessionExpiresAt: walletSession.expiresAt,
  };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token || token.length > 128) return;
  await revokeWalletSession(hashSessionToken(token), new Date().toISOString());
}
