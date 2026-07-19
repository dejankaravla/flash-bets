# FlashBets Standalone MongoDB Checkpoint 3.5

> Historical persistence checkpoint. See `FINAL_RELEASE_CHECKPOINT.md` for the
> current release-candidate verification; the limitations below remain active.

## Outcome

FlashBets no longer requires a MongoDB replica set or mandatory multi-document
transactions. A normal local URI works:

```text
mongodb://localhost:27017/flashbets
```

The application detects transaction support after connecting. Replica sets and
mongos continue to use transactions automatically. Standalone MongoDB uses the
same services and repositories with atomic document operations, deterministic
identifiers, unique indexes, compensation, and retry-safe settlement. Lack of
transaction support never causes startup to be refused.

No MongoDB/Mongoose persistence, repositories, services, deterministic IDs,
unique indexes, FlashPoints logic, settlement logic, replay behavior, or
receipts were removed.

## Changes made

### Capability-aware persistence

`lib/server/db/mongoose.ts` now:

- connects to `mongodb://127.0.0.1:27017/flashbets` by default;
- calls MongoDB's `hello` command and caches whether the deployment advertises
  logical sessions plus a replica-set name or mongos identity;
- reports `transactional` or `standalone` through `mongoPersistenceMode()`;
- runs the existing callback in a transaction when supported;
- runs the callback without a session on standalone MongoDB; and
- treats a MongoDB transaction-unsupported response as a capability fallback,
  not an application-fatal configuration error.

`lib/server/repositories/transaction-repository.ts` and session-aware repository
methods now accept an optional `ClientSession`. Market ingestion and JSON
migration therefore retain their existing transaction boundary on supported
deployments and execute normally on standalone MongoDB.

### Authentication

`lib/server/auth-service.ts` and
`lib/server/repositories/auth-repository.ts` no longer rely on a
multi-document transaction for sign-in.

- Challenge creation performs expired-record cleanup on a best-effort basis.
- Cleanup failure emits only a fixed warning and does not fail challenge
  creation by itself.
- Wallet, origin, expiry, one-time use, and Ed25519 signature checks are
  unchanged.
- Challenge consumption is a conditional atomic update requiring `usedAt` to
  remain null.
- Concurrent verification attempts therefore cannot consume one challenge
  twice.
- Session creation inserts the new opaque-token record before revoking older
  sessions for the wallet.
- Session tokens remain hashed at rest and the browser cookie behavior is
  unchanged.

### One account and one initial grant

`ensureWalletAccount()` retains the unique wallet index and uses
`findOneAndUpdate(..., {$setOnInsert: account}, {upsert: true})`. Concurrent
requests for the same wallet converge on exactly one document and exactly one
initial 1,000 FlashPoint grant. Existing balances are never reset by sign-in.

### Prediction placement

`lib/server/prediction-service.ts` keeps the same validation, deterministic
prediction ID, unique wallet/market rule, integer amount policy, market state,
freshness, and available-to-locked balance movement.

When a transaction session is available, the original lock-and-insert sequence
runs inside that transaction. On standalone MongoDB the sequence is:

1. Revalidate fixture, market, wallet, side, amount, and current FlashPoints.
2. Insert the deterministic prediction reservation. Unique indexes permit only
   one wallet prediction for the market.
3. Conditionally update the wallet account only when `available >= amount`,
   decrementing available and incrementing locked in one atomic document write.
4. If that conditional lock is definitively rejected, delete only the still
   unfinished reservation.
5. Return success only after the point lock succeeds.

This ordering prevents concurrent requests from locking points twice for the
same market. `deletePredictionReservation()` is intentionally narrow: it cannot
delete a settled prediction or a prediction already linked to a receipt.

### Settlement and receipts

`lib/server/settlement-service.ts` now coordinates settlement as an idempotent,
restartable sequence instead of requiring one multi-document transaction.

1. Read an existing deterministic receipt for the market, if present.
2. Otherwise move the market forward to `WAITING_FOR_SETTLEMENT`, lock pending
   predictions, calculate the TxLINE/replay delta, and calculate integer awards.
3. Persist the deterministic receipt with `$setOnInsert` under unique receipt
   and market indexes. Concurrent settlers converge on the first receipt.
4. For each award, conditionally update the wallet only when the receipt ID has
   not already been applied and sufficient locked points remain.
5. The wallet's balance/stat changes and hidden applied-receipt marker are
   written atomically in the same document update.
6. Finalize the prediction only from an unfinished state or as an idempotent
   repeat of the exact same receipt and result.
7. Finalize the market only from an unfinished state or as an idempotent repeat
   of the exact same receipt and result.

If a process stops after the receipt is written, the settlement worker can run
the same market again. Already-applied wallet awards are detected by the receipt
marker and are not duplicated. The permanent receipt remains the authoritative
award plan for all retries.

Void settlement uses the same path. Refunds, winner rewards, loser accounting,
integer remainder allocation, correction delay, timeout behavior, TxLINE/replay
snapshot evidence, and settlement versioning are unchanged.

### Replay

Replay mode, the server-owned replay clock, controls, datasets, market path,
automatic settlement worker, and activity SSE are unchanged. Restart still:

1. abandons the prior replay run;
2. settles unfinished markets as void;
3. refunds locked FlashPoints exactly once;
4. writes permanent deterministic receipts; and
5. selects a fresh replay-run identity.

The restart path is now covered against standalone MongoDB.

### Test and smoke harnesses

`scripts/run-settlement-tests.mjs` and
`scripts/run-settlement-smoke.mjs` now start a plain temporary `mongod` without
`--replSet`, replica-set initiation, or primary-election polling. The normal
test database URI has no `replicaSet` query parameter.

`npm run test:standalone`, `npm run test:settlement`, and
`npm run test:replay` intentionally execute the same focused standalone suite.

## Transaction removal strategy

The goal was not to simulate a multi-document transaction. Each invariant is
owned by the smallest authoritative MongoDB document that can enforce it:

| Invariant | Enforcement |
| --- | --- |
| One account per wallet | Unique wallet index plus `$setOnInsert` upsert |
| Exactly one initial 1,000-point grant | Initial values exist only in `$setOnInsert` |
| Challenge used once | Conditional challenge update requiring `usedAt: null` |
| One prediction per wallet/market | Deterministic prediction ID and unique compound index |
| Cannot lock more than available | Conditional wallet update with `available: {$gte: amount}` |
| One receipt per market | Deterministic receipt ID and unique market/receipt indexes |
| Award applied once per wallet | Receipt marker and balance/stat changes in one conditional wallet update |
| Prediction finalizes once | Conditional unfinished-or-same-receipt update |
| Market finalizes once | Conditional unfinished-or-same-receipt update |
| Replay refund applied once | Same receipt-marked void settlement path |

Cross-document workflows are ordered so the durable receipt or reservation
exists before dependent updates, and operations are safe to retry where the
worker owns recovery. Transactions remain enabled where MongoDB supports them.

## Standalone compatibility

Verified deployment shape:

- MongoDB 5.0 standalone `mongod`;
- no `--replSet` option;
- no `rs.initiate()` call;
- no replica-set URI query parameter; and
- `MONGODB_URI=mongodb://127.0.0.1:<temporary-port>/flashbets_test`.

Supported behavior on that deployment:

- signed wallet challenge authentication;
- one-time challenges and wallet-bound sessions;
- exactly one FlashPoints account and one 1,000-point grant;
- prediction validation and available-to-locked movement;
- one prediction per wallet/market under concurrency;
- market lifecycle and automatic settlement;
- deterministic winner rewards and void refunds;
- permanent settlement receipts;
- concurrent and repeated settlement without duplicate awards;
- replay settlement; and
- replay restart void/refund behavior.

Replica-set and mongos compatibility is retained in code by the optional session
path. This checkpoint specifically verifies the requested standalone deployment;
it does not represent a new end-to-end replica-set test run.

## Tests executed

The focused test runner was executed directly with the repository's existing
dependencies and a temporary standalone MongoDB server:

```text
node scripts/run-settlement-tests.mjs
```

Result on 2026-07-18:

```text
tests 30
pass 30
fail 0
```

Coverage includes all inherited Prompt 1-3 cases plus explicit Prompt 3.5 cases:

- the suite confirms `mongoPersistenceMode()` is `standalone`;
- twelve concurrent account creations produce one account with 1,000 available
  points;
- concurrent same-wallet prediction requests create one prediction and lock
  points once;
- concurrent settlers return one receipt and apply rewards once; and
- replay restart voids an unfinished prediction, writes a receipt, and restores
  the wallet from 100 locked points to 1,000 available points exactly once.

No production build, lint command, ESLint command, or TypeScript compiler was
run. No dependency was installed or upgraded.

## Remaining limitations

Standalone MongoDB cannot provide all-or-nothing rollback across arbitrary
documents. The implementation minimizes and exposes that difference:

- If the process stops after a prediction reservation insert but before the
  wallet lock completes, an unfinished unbacked reservation can remain. A
  definite lock rejection is compensated immediately, but process termination
  between writes requires reconciliation or operator cleanup.
- If challenge consumption succeeds and session insertion then fails, the
  challenge remains correctly consumed and the user must request a new
  challenge. No unauthorized session or duplicate grant is created.
- Settlement may be temporarily partial across wallets or between wallet,
  prediction, and market documents. The deterministic receipt plus per-wallet
  receipt marker makes it resumable and prevents duplicate value application;
  the automatic worker performs the retry while the market remains unfinished.
- Applied receipt IDs are stored on wallet account documents. This array grows
  with settlement history and should be replaced by a separately indexed ledger
  or bounded archival strategy for high-volume production use.
- Capability detection is cached for the active connection. Changing deployment
  topology requires a reconnect or process restart before mode is re-evaluated.
- A replica set still offers a stronger crash boundary for prediction placement,
  migration, and multi-document market updates. It is optional, not required.
- Replay coordination remains process-local, as documented in
  `REPLAY_CHECKPOINT.md`; multi-instance replay requires a durable coordinator.

These limitations do not restore the old mandatory replica-set requirement.
They identify the production-hardening work needed beyond the requested
standalone hackathon path.
