# FlashBets

FlashBets is a football micro-prediction hackathon prototype. A Solana wallet is
used only as a signed identity. Each authenticated wallet receives 1,000
non-transferable FlashPoints and can make five-minute Yes/No Goal or Corner
predictions.

FlashPoints have no monetary value. They cannot be purchased, transferred,
withdrawn, or redeemed. Wallet signatures authenticate a FlashBets profile.

## 5-minute Quick Start

1. Start a normal local MongoDB server.
2. Copy `.env.example` to `.env.local` and set:

   ```text
   FLASHBETS_MODE=REPLAY
   MONGODB_URI=mongodb://localhost:27017/flashbets
   ```

3. If the Prompt 1 JSON store contains data, run `npm run migrate:mongo` once.
4. Run `npm run dev` and open `http://localhost:3000`.
5. Connect a Solana wallet, sign the identity message, and confirm the 1,000
   FlashPoints balance.
6. Open **Matches**, choose a Replay fixture, place a Goal or Corner Yes/No
   prediction, select **10x**, and press **Play**.
7. After automatic settlement, open **My Predictions** and expand the permanent
   receipt to show its fixture, window, result, delta, stake, return, timestamp,
   receipt ID, and settlement version.

The presenter script and recovery notes are in `JUDGE_WALKTHROUGH.md`.

## Release candidate

Prompt 4.5 is the final consistency and verification pass. The dashboard keeps
selectable replay datasets in **Replay** and loads durable completed replay runs
plus persisted full-time Live fixtures in **Finished**. Historical entries no
longer depend on the currently active process-local replay.

## Standalone MongoDB Checkpoint 3.5

FlashBets now runs against a normal standalone MongoDB server such as
`mongodb://localhost:27017/flashbets`. The persistence layer detects whether the
connected deployment supports transactions. Replica sets and mongos use
transactions automatically; standalone servers use atomic document updates,
deterministic IDs, unique indexes, compensating prediction cleanup, and
idempotent settlement receipts. Startup never fails merely because transactions
are unavailable.

See `STANDALONE_MONGODB_CHECKPOINT.md` for the exact write strategy, verified
concurrency behavior, and remaining non-transactional failure windows.

## Replay Checkpoint 3

FlashBets now has two configuration-selected data modes:

- `LIVE` consumes server-authenticated TxLINE fixture and score sources.
- `REPLAY` loads validated datasets from `replays/`, exposes Play, Pause,
  Restart, and 0.5×/1×/2×/5×/10× controls, and drives the same market,
  prediction, settlement, receipt, and FlashPoints services with a server-owned
  replay clock.

The mode is always visible in the interface. Replay is explicitly labeled and
never presented as a currently live match. The packaged fixtures are curated,
deterministic TxLINE-normalized demonstration datasets; replace them with
approved recorded TxLINE datasets before making external provenance statements.

The implemented path includes:

- server-owned TxLINE normalization and SSE delivery;
- external, validated replay datasets and deterministic playback;
- stable five-minute Goal and Corner markets;
- signed wallet authentication and HttpOnly sessions;
- MongoDB-backed FlashPoints accounts and predictions that support standalone
  MongoDB and automatically retain transactions where available;
- a server-started automatic settlement worker;
- exact integer pool rewards, void refunds, and permanent receipts;
- activity SSE so My Predictions updates after placement or settlement without
  scheduling settlement from the browser;
- Replay/Live and result filters with newest-first history;
- durable Finished match and completed replay-run history; and
- clear loading, empty, unavailable, and replay states.

## Runtime architecture

```text
LIVE:   TxLINE raw -> normalization ---------+
                                               -> normalized score ingestion
REPLAY: validated normalized replay adapter --+   -> MarketService -> MongoDB

instrumentation.ts -> SettlementWorker -> SettlementService -> MongoDB
wallet -> signed session -> PredictionService -> MongoDB
My Predictions <- prediction/market/receipt API + wallet activity SSE
```

Replay changes the event source and authoritative business clock, not the
business rules. Authentication/session expiry remains on real server time.

## Local startup

1. Copy `.env.example` to `.env.local`.
2. Set `FLASHBETS_MODE=REPLAY` for the deterministic demo or `LIVE` for TxLINE.
3. Configure `MONGODB_URI`. A normal standalone URI is sufficient, for example
   `mongodb://localhost:27017/flashbets`.
4. Run `npm run migrate:mongo` once if Prompt 1 JSON data exists.
5. For `LIVE`, add server-only TxLINE credentials.
6. Run `npm run dev`.

Replica-set configuration is optional. FlashBets detects transaction support
and uses it when available; otherwise it uses the standalone-safe persistence
path.

## Judge demo

With `FLASHBETS_MODE=REPLAY`:

1. Connect a wallet and sign in.
2. Open the dashboard and choose a Replay fixture.
3. On the paused first frame, choose an open Goal or Corner market and lock
   FlashPoints on Yes or No.
4. Select 10× and press Play.
5. Watch the market lock, run, wait through the correction delay, and settle.
6. Open My Predictions to inspect the result, balance change, source mode, and
   settlement receipt.

Restart creates a new run identity. If a previous run was interrupted, its open
predictions are voided and refunded through the existing settlement service.
The interface asks for confirmation before this action and explains the
void/refund consequence.

## Verification

```powershell
npx tsc --noEmit
npm run lint
npm run build
npm run test:replay
npm run test:standalone
npm run smoke:settlement
```

The focused suite starts an isolated temporary standalone `mongod` with no
replica-set configuration. It covers wallet authentication, the one-account
1,000-point grant, concurrent prediction placement, replay loading and restart,
timing, automatic worker scheduling, settlement, void refunds, deterministic
receipts, and concurrent-settlement idempotency. The smoke helper runs `next
dev` with Webpack and an isolated `.next-smoke` development cache.

See `REPLAY_CHECKPOINT.md` for the Prompt 3 handoff, `ARCHITECTURE.md` for active
boundaries, `ENVIRONMENT.md` for configuration, and
`STANDALONE_MONGODB_CHECKPOINT.md` for the Prompt 3.5 persistence handoff.
`POLISH_CHECKPOINT.md` records the Prompt 4 UX, accessibility, performance,
reliability, and hackathon-readiness result. `FINAL_RELEASE_CHECKPOINT.md`
records the final Prompt 4.5 release gate.
