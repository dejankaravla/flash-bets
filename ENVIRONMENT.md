# FlashBets Environment

## Runtime variables

| Name | Visibility | Purpose |
| --- | --- | --- |
| `FLASHBETS_MODE` | Server only | `LIVE` selects TxLINE; `REPLAY` selects validated files under `replays/`; defaults to `LIVE` |
| `MONGODB_URI` | Server only | MongoDB database URI; standalone, replica-set, and mongos deployments are supported |
| `FLASHBETS_JSON_MIGRATION_PATH` | Server only | Prompt 1 JSON source path; defaults to `.data/flash-bets-foundation.json` |
| `TXLINE_API_URL` | Server only | TxLINE base URL; defaults to the development source |
| `TXLINE_JWT` | Server only, sensitive | TxLINE bearer credential |
| `TXLINE_API_TOKEN` | Server only, sensitive | TxLINE API token |
| `TXLINE_COMPETITION_ID` | Server only | Optional fixture registry filter |
| `FLASHBETS_CHALLENGE_TTL_SECONDS` | Server only | Wallet challenge lifetime; default 300 |
| `FLASHBETS_SESSION_TTL_SECONDS` | Server only | Opaque session lifetime; default 604800 |
| `FLASHBETS_MARKET_LEAD_MINUTES` | Server only | Number of future market minutes generated; default 15 |
| `FLASHBETS_TXLINE_STALE_AFTER_SECONDS` | Server only | Maximum age for opening and prediction acceptance; default 45 |
| `SETTLEMENT_DELAY_SECONDS` | Server only | Correction period after market end; default 120 |
| `SETTLEMENT_TIMEOUT_SECONDS` | Server only | Maximum delay after `settlesAt` before forced void; default 900 |
| `SETTLEMENT_WORKER_INTERVAL_MS` | Server only | Delay between automatic settlement cycles; default 1000 |
| `NEXT_PUBLIC_SOLANA_RPC` | Public, optional | Wallet Adapter endpoint for identity only; no transaction use |

Only `NEXT_PUBLIC_SOLANA_RPC` may reach the browser. Never expose MongoDB,
TxLINE, session, or settlement configuration through `NEXT_PUBLIC_` variables.

## Optional tooling variables

| Name | Purpose | Default |
| --- | --- | --- |
| `FLASHBETS_NEXT_DIST_DIR` | Next.js development cache override; smoke uses an isolated cache | `.next` for normal commands |
| `MONGOD_PATH` | Local MongoDB executable used by focused and smoke runners | Platform-specific local `mongod` |
| `FLASHBETS_TEST_MONGO_PORT` | Focused-suite MongoDB port | `27118` |
| `FLASHBETS_SMOKE_MONGO_PORT` | Smoke MongoDB port | `27119` |
| `FLASHBETS_SMOKE_APP_PORT` | Smoke Next.js development port | `3212` |

These variables are not required for the FlashBets product runtime.

`NODE_ENV` and `NEXT_RUNTIME` are supplied by Next.js. The smoke runner also
supplies `FLASHBETS_SMOKE_ORIGIN` directly to its child process. These are
internally managed execution variables, not user configuration, so they are not
listed in `.env.example`.

## MongoDB requirement

FlashBets supports a default standalone local MongoDB server. The normal local
URI is:

```text
mongodb://localhost:27017/flashbets
```

At connection time the server detects transaction support. Replica sets and
mongos use MongoDB transactions automatically. A standalone server uses atomic
single-document updates, deterministic identifiers, unique indexes,
compensation for a rejected point lock, and idempotent receipt-marked
settlement. The application does not reject startup because transactions are
unavailable.

The focused test and smoke helpers start an isolated temporary standalone
`mongod` when the executable is available. They never connect to TxLINE.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Choose `FLASHBETS_MODE=REPLAY` for the deterministic demo or `LIVE` for TxLINE.
3. Configure `MONGODB_URI`, for example
   `mongodb://localhost:27017/flashbets`. No replica-set setup is required.
4. Run `npm run migrate:mongo` once if the Prompt 1 JSON file contains data.
5. In Live Mode, add server-only TxLINE credentials.
6. Run `npm run dev`.

Replay Mode does not require TxLINE credentials and works with standalone
MongoDB while still using the real FlashPoints ledger, settlement service, and
permanent receipts. Mode changes require a server restart; there is
intentionally no browser mode switch.

The migration is idempotent and does not delete the JSON source. Runtime code no
longer reads that file. Missing TxLINE credentials produce truthful unavailable
states and a 503 stream response; they do not enable mock fixtures.

## Verification commands

```powershell
npx tsc --noEmit
npm run lint
npm run build
npm run test:settlement
npm run test:replay
npm run test:standalone
npm run smoke:settlement
```

The release gate runs the standalone TypeScript compiler, ESLint, and a
production Next.js build before the runtime checks. The test commands share the
same 30-test focused suite and start a plain standalone temporary MongoDB server
without `--replSet`. The smoke helper starts temporary MongoDB and Next
development processes, checks all principal routes, completes signed wallet
authentication, completes a Replay run, verifies its durable Finished history,
invokes the authenticated development settlement runner, verifies logout, and
removes its temporary database and isolated Next development cache. It forces
`FLASHBETS_MODE=REPLAY` and uses Webpack to keep the judge smoke path
deterministic on Windows.

## Hackathon demo configuration

Use `FLASHBETS_MODE=REPLAY` for judging. It requires MongoDB but no TxLINE
credential and clearly labels all events as historical replay data. Use
`FLASHBETS_MODE=LIVE` only when valid server-side TxLINE credentials and a real
live fixture are available. There is no silent Live-to-Replay fallback.

Do not expose `TXLINE_JWT`, `TXLINE_API_TOKEN`, MongoDB URIs, or session tokens
in screenshots or logs.
