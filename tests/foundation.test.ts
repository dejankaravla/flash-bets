import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

import {
  createWalletChallenge,
  readAuthenticatedUser,
  verifyWalletChallenge,
} from "../lib/server/auth-service.ts";
import { disconnectMongo } from "../lib/server/db/mongoose.ts";
import { mongoPersistenceMode } from "../lib/server/db/mongoose.ts";
import {
  ensureFlashPointsAccount,
  readFlashPointsAccount,
} from "../lib/server/flashpoints-service.ts";
import { placePrediction } from "../lib/server/prediction-service.ts";
import { clearFlashBetsCollections } from "../lib/server/repositories/test-repository.ts";
import { countWalletAccounts } from "../lib/server/repositories/wallet-account-repository.ts";
import { listPredictionsForWalletRecord } from "../lib/server/repositories/prediction-repository.ts";
import { fixtureAt, marketAt, seedRecords } from "./helpers.ts";

beforeEach(clearFlashBetsCollections);
after(disconnectMongo);

test("the focused suite is running against standalone MongoDB", async () => {
  assert.equal(await mongoPersistenceMode(), "standalone");
});

test("wallet authentication is signed, wallet-bound, one-time, and creates 1000 FlashPoints once", async () => {
  const keypair = Keypair.generate();
  const wallet = keypair.publicKey.toBase58();
  const origin = "http://localhost:3000";
  const challenge = await createWalletChallenge(wallet, origin);
  const signature = bs58.encode(
    nacl.sign.detached(new TextEncoder().encode(challenge.message), keypair.secretKey),
  );
  const verified = await verifyWalletChallenge({
    challengeId: challenge.challengeId,
    wallet,
    signature,
    origin,
  });
  assert.equal(verified.user.flashPoints.available, 1_000);
  assert.equal((await readAuthenticatedUser(verified.token))?.wallet, wallet);

  await assert.rejects(
    verifyWalletChallenge({
      challengeId: challenge.challengeId,
      wallet,
      signature,
      origin,
    }),
    (error: unknown) => (error as { code?: string }).code === "CHALLENGE_USED",
  );
  assert.equal((await ensureFlashPointsAccount(wallet)).available, 1_000);
});

test("a challenge cannot authenticate a different wallet", async () => {
  const owner = Keypair.generate();
  const attacker = Keypair.generate();
  const origin = "http://localhost:3000";
  const challenge = await createWalletChallenge(owner.publicKey.toBase58(), origin);
  const signature = bs58.encode(
    nacl.sign.detached(new TextEncoder().encode(challenge.message), attacker.secretKey),
  );
  await assert.rejects(
    verifyWalletChallenge({
      challengeId: challenge.challengeId,
      wallet: attacker.publicKey.toBase58(),
      signature,
      origin,
    }),
    (error: unknown) => (error as { code?: string }).code === "INVALID_CHALLENGE",
  );
});

test("prediction placement atomically locks whole FlashPoints and enforces one wallet prediction per market", async () => {
  const wallet = Keypair.generate().publicKey.toBase58();
  const nowMs = Date.now();
  const fixture = fixtureAt(nowMs);
  const market = marketAt(nowMs);
  await seedRecords({ fixture, market });
  const prediction = await placePrediction({
    wallet,
    marketId: market.marketId,
    side: "YES",
    amount: 100,
    nowMs,
  });
  assert.equal(prediction.amount, 100);
  assert.equal(prediction.status, "PENDING");
  assert.deepEqual(
    { available: (await readFlashPointsAccount(wallet))?.available, locked: (await readFlashPointsAccount(wallet))?.locked },
    { available: 900, locked: 100 },
  );

  await assert.rejects(
    placePrediction({
      wallet,
      marketId: market.marketId,
      side: "NO",
      amount: 10,
      nowMs,
    }),
    (error: unknown) => (error as { code?: string }).code === "PREDICTION_EXISTS",
  );
  assert.equal((await readFlashPointsAccount(wallet))?.available, 900);
});

test("prediction validation rejects unknown, insufficient, locked, and non-integer requests", async () => {
  const wallet = Keypair.generate().publicKey.toBase58();
  const nowMs = Date.now();
  const fixture = fixtureAt(nowMs);
  const market = marketAt(nowMs);
  await seedRecords({ fixture, market });
  await assert.rejects(
    placePrediction({ wallet, marketId: "unknown", side: "YES", amount: 1, nowMs }),
    (error: unknown) => (error as { code?: string }).code === "UNKNOWN_MARKET",
  );
  await assert.rejects(
    placePrediction({ wallet, marketId: market.marketId, side: "YES", amount: 1_001, nowMs }),
    (error: unknown) => (error as { code?: string }).code === "INSUFFICIENT_FLASHPOINTS",
  );
  await assert.rejects(
    placePrediction({ wallet, marketId: market.marketId, side: "YES", amount: 1.5, nowMs }),
    (error: unknown) => (error as { code?: string }).code === "INVALID_FLASHPOINTS",
  );
  await assert.rejects(
    placePrediction({
      wallet,
      marketId: market.marketId,
      side: "YES",
      amount: 1,
      nowMs: nowMs + 60_000,
    }),
    (error: unknown) => (error as { code?: string }).code === "MARKET_NOT_OPEN",
  );
});

test("Mongo persistence survives a connection restart", async () => {
  const wallet = Keypair.generate().publicKey.toBase58();
  await ensureFlashPointsAccount(wallet);
  await disconnectMongo();
  assert.equal((await readFlashPointsAccount(wallet))?.available, 1_000);
});

test("concurrent wallet creation grants exactly one 1000-point account", async () => {
  const wallet = Keypair.generate().publicKey.toBase58();
  const accounts = await Promise.all(
    Array.from({ length: 12 }, () => ensureFlashPointsAccount(wallet)),
  );
  assert.ok(accounts.every((account) => account.available === 1_000));
  assert.equal(await countWalletAccounts(), 1);
});

test("concurrent standalone prediction placement locks points exactly once", async () => {
  const wallet = Keypair.generate().publicKey.toBase58();
  const nowMs = Date.now();
  const fixture = fixtureAt(nowMs);
  const market = marketAt(nowMs);
  await seedRecords({ fixture, market });
  const attempts = await Promise.allSettled([
    placePrediction({ wallet, marketId: market.marketId, side: "YES", amount: 100, nowMs }),
    placePrediction({ wallet, marketId: market.marketId, side: "NO", amount: 100, nowMs }),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
  assert.equal((await listPredictionsForWalletRecord(wallet)).length, 1);
  assert.deepEqual(
    { available: (await readFlashPointsAccount(wallet))?.available, locked: (await readFlashPointsAccount(wallet))?.locked },
    { available: 900, locked: 100 },
  );
});
