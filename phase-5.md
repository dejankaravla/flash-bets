### Context & Objective

We are moving into Phase 5 (The Production Data Swap). We are replacing our internal simulation engine (`lib/mockTxLine.ts`) with a real, live proxy connection to the authenticated TxLINE API endpoints (`https://txline.txodds.com/api/scores/stream` and `/api/odds/stream`).

### Task Instructions

1. **Environment Configuration:**
   - Expect `TXLINE_API_TOKEN` and `TXLINE_API_URL` to be present in `process.env`. Never expose these variables to the client-side bundle.

2. **Refactor Singleton to Real TxLINE Client (`lib/txLineClient.ts`):**
   - Transform the internal module singleton. Instead of driving state via a recursive `setTimeout` loop, initialize a server-side client that connects natively to the TxLINE SSE endpoints using the authentication tokens.
   - **Multi-Fixture Support:** The internal `snapshot` store must change from a single fixture object to a key-value record/map (`Record<string, MatchSnapshot>`) to hold running states for all active live tournament fixtures streamed by TxLINE.
   - **Upstream Resilience:** Implement an auto-reconnect event loop handler. If the server-to-server stream drops or throws an HTTP 429/5xx, clear references and retry connection with a 5-second backoff delay.
   - Maintain the exact public subscription interface: `subscribe(fixtureId, listener): () => void` so the rest of the application layers don't break. When a message arrives from TxLINE, find the relevant `fixtureId` listeners and fan out the data payload.

3. **Update SSE Route Handler (`app/api/stream/route.ts`):**
   - Update the `GET` route handler to extract the target fixture identification parameter from the URL query string (e.g., `const { searchParams } = new URL(request.url); const fixtureId = searchParams.get("fixtureId");`).
   - Pass this dynamic `fixtureId` straight into the refactored `txLineSimulator.subscribe(fixtureId, ...)` handler.
   - Maintain all Phase 1 guardrails: `force-dynamic`, `force-no-store`, `X-Accel-Buffering: no`, and the 30-second heartbeat thread.

4. **Dynamic Route Validation Refactor (`app/match/[id]/page.tsx`):**
   - Remove the static `MOCK_FIXTURE_ID` restriction block. Allow the dynamic `id` parameter to pass seamlessly into the `<LiveMatchArena fixtureId={id} />` component.
   - Update the client-side `useTxLineStream` hook inside the arena to append the query token: `new EventSource(`/api/stream?fixtureId=${fixtureId}`)`.

5. **Live Dashboard Hydration (`app/dashboard/page.tsx`):**
   - Refactor the tournament dashboard. Instead of importing static rows from `mock-dashboard.ts`, execute a standard HTTP fetch directly to the TxLINE tournament fixture registry API endpoint on the server side.
   - Dynamically map the live, upcoming, and finished fixtures into their respective UI tab segments.

Execute `npm run build` to ensure the upstream streaming configurations bundle flawlessly without breaking existing static routes or client layouts.
