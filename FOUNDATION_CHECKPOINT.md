# FlashBets Foundation Checkpoint 1

> Historical checkpoint record. Prompt 2 has replaced the JSON runtime store
> with MongoDB and completed settlement. See `SETTLEMENT_CHECKPOINT.md` and
> `ARCHITECTURE.md` for the current implementation.
> Prompt 4.5 is the release-candidate truth source; see
> `FINAL_RELEASE_CHECKPOINT.md` for current verification.

## Completed

- Established wallet identity and non-transferable FlashPoints as the product
  account model.
- Added signed wallet authentication with expiring, origin-bound, wallet-bound,
  one-time challenges and opaque HttpOnly sessions.
- Added one persistent FlashPoints account per wallet with exactly 1,000 initial
  points, granted once.
- Added canonical Goal and Corner markets only, with stable persisted IDs,
  TxLINE freshness gates, eligible-half gates, and server-authoritative locking.
- Added an authenticated prediction API that validates the market, fixture,
  amount, duplicate rule, and account in one atomic persisted mutation.
- Added My Predictions and truthful FlashPoints account UI.
- Added Live, Upcoming, Finished, and Unavailable dashboard states based on
  TxLINE state rather than a browser-invented match window.
- Removed misleading simulated leaderboard, pool, odds, and percentage UI.
- Removed the unused odds stream; the active TxLINE adapter handles the football
  facts needed for Goal and Corner predictions.
- Added focused foundation tests and a safe local authentication smoke script.
- Updated README, architecture, and environment documentation.

Verification completed:

- 11 focused tests pass.
- Development-mode route compilation returned 200 for `/`, `/my-predictions`,
  `/leaderboard`, `/api/auth/session`, and `/api/markets`.
- `/api/flashpoints` returned 401 without a session.
- The local smoke flow completed challenge, signature verification, session,
  1,000-point account lookup, logout, and post-logout rejection.

## Remaining

- Prompt 2 must define result processing, correction handling, settlement,
  refunds, and awards before pending predictions can change state.
- Replay mode remains unimplemented.
- Leaderboard scoring remains unimplemented and the route is truthful/disabled.
- The JSON store must be replaced before multi-instance or serverless deployment.
- Rate limiting and structured production observability remain deployment work.
- Live TxLINE behavior still depends on valid credentials, available fixtures,
  and the upstream development service.

## Architecture decisions

1. Wallets are identity credentials only. Wallet connection is not
   authentication; a signed challenge is required.
2. FlashPoints are integers and exist only in server persistence. They have no
   monetary value and no transfer, purchase, withdrawal, or redemption path.
3. The server is authoritative for sessions, fixture freshness, market state,
   duplicate prediction policy, and points accounting.
4. One wallet may create at most one prediction per market. The unique prediction
   ID is deterministic from wallet and market.
5. Prediction placement atomically moves points from `available` to `locked` and
   inserts the prediction. Failed validation writes nothing.
6. Goal and Corner are the only active market types. Only first and second half
   can generate markets.
7. Existing market records are never overwritten. Stable IDs include version,
   fixture, type, half, and five-minute bounds.
8. Disconnected prototype modules were removed from the active application.

## Files changed

Core additions and replacements:

- `lib/domain/flash-bets.ts`
- `lib/market-policy.ts`
- `lib/server/mvp-store.ts`
- `lib/server/auth-service.ts`
- `lib/server/session.ts`
- `lib/server/flashpoints-service.ts`
- `lib/server/prediction-service.ts`
- `lib/server/request.ts`
- `lib/server/errors.ts`
- `lib/txLineClient.ts`
- `lib/txline-fixtures.ts`
- `lib/txline-normalize.ts`

Routes and UI:

- `app/api/auth/*`
- `app/api/flashpoints/route.ts`
- `app/api/markets/route.ts`
- `app/api/predictions/route.ts`
- `app/my-predictions/page.tsx`
- `components/landing/landing-hero.tsx`
- `components/dashboard/*`
- `components/match/*`
- `components/my-predictions/*`
- `components/wallet-address-badge.tsx`
- `lib/hooks/use-wallet-auth.tsx`
- `lib/hooks/use-predictions.ts`
- `lib/hooks/use-canonical-markets.ts`

Removed from the active tree:

- mock leaderboard records and table;
- obsolete My Bets UI;
- client match-clock and match-window generators;
- obsolete amount tests from the active checkpoint;
- `/api/mvp/*` active routes.

Documentation and verification:

- `README.md`
- `ARCHITECTURE.md`
- `ENVIRONMENT.md`
- `.env.example`
- `tests/foundation.test.ts`
- `tests/market-policy.test.ts`
- `tests/txline-normalize.test.ts`
- `scripts/foundation-smoke.ts`

## APIs added

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/challenge` | Public, same-origin | Persist a wallet-bound login challenge |
| POST | `/api/auth/verify` | Signed challenge, same-origin | Verify Ed25519 signature and create session/account |
| GET | `/api/auth/session` | Optional cookie | Return minimal current-session DTO |
| POST | `/api/auth/logout` | Cookie, same-origin | Revoke session and clear cookie |
| GET | `/api/flashpoints` | Required | Return the authenticated wallet's account |
| GET | `/api/markets?fixtureId=...` | Public | Return persisted fixture freshness and projected markets |
| GET | `/api/predictions` | Required | Return authenticated wallet predictions and account |
| POST | `/api/predictions` | Required, same-origin | Validate and atomically create one prediction |

The old `/api/mvp/markets` and wallet-query `/api/mvp/positions` endpoints were
removed. The browser can no longer select another wallet through a query string.

## Database changes

The local store is schema version 2 at `.data/flash-bets-foundation.json` by
default. It contains maps for fixtures, markets, predictions, FlashPoints
accounts, reserved settlement receipts, authentication challenges, and hashed
sessions.

The old version 1 prototype schema is intentionally not migrated. A serialized
mutation queue plus temporary-file rename provides atomic behavior in one Node.js
process. This is not a replacement for database transactions or cross-process
unique constraints.

## Authentication flow

1. The browser sends the connected wallet address to the challenge endpoint.
2. The server validates the Solana public key and persists a random challenge
   tied to wallet, origin, issue time, and expiration.
3. The wallet signs the exact explanatory message with `signMessage`.
4. The browser returns challenge ID, wallet, and Base58 signature.
5. The server atomically verifies wallet binding, origin, expiry, unused state,
   and Ed25519 signature.
6. The server consumes the challenge, revokes older sessions for that wallet,
   creates or reuses the FlashPoints account, and stores only a hash of a random
   session token.
7. The raw token is delivered in an HttpOnly, SameSite=Strict cookie.
8. Every private API resolves the wallet from that server session, never from a
   client-provided wallet field.

## FlashPoints model

Each account is keyed by its canonical Solana wallet address and contains only
safe integers:

| Field | Checkpoint 1 behavior |
| --- | --- |
| `available` | Starts at 1,000 once; decreases on prediction placement |
| `locked` | Increases by the same whole-number prediction amount |
| `won` | Starts at 0; unchanged until Prompt 2 |
| `lost` | Starts at 0; unchanged until Prompt 2 |
| `refunded` | Starts at 0; unchanged until Prompt 2 |

FlashPoints are whole-number, non-transferable application credits with no
monetary value.

## Known risks

- File persistence is one-process only and can lose coordination under multiple
  workers or serverless instances.
- The in-process mutation queue is not a distributed lock.
- Authentication and prediction endpoints need host-level rate limiting before
  public exposure.
- Origin comparison assumes the externally visible request origin is preserved by
  the reverse proxy.
- Session revocation is persisted, but there is no user-facing device/session
  management screen.
- TxLINE freshness assumes its message timestamp is a trustworthy current source
  timestamp and that server clock skew is small.
- First-half and second-half timing is minute-granular because the observed
  normalized payload does not provide authoritative match seconds.
- Pending points remain locked because settlement is deliberately absent.

## Recommendation for Prompt 2

Prompt 2 should begin with a durable settlement design for FlashPoints only. It
should define authoritative opening/closing evidence, correction delay, missing
data, cancellation/refund rules, idempotent receipts, and atomic transitions for
`available`, `locked`, `won`, `lost`, and `refunded`. It should also replace the
JSON store with a transactional database or provide a concrete migration path.

Complete and test the FlashPoints settlement lifecycle before extending the
product surface.
