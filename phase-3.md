### Context & Objective

Phase 2 is complete. We now have a functioning Live Match Arena. We are moving into Phase 3: Building the **Structural Page Ecosystem and Global Navigation**.
**Path Enforcement:** There is NO `src/` directory. All folders and files must be created at the root level (`app/`, `components/`, etc.).

### Detailed Task Instructions

1. **Global Navigation Component (`components/bottom-nav.tsx`):**
   - Create a mobile-first, fixed bottom navigation bar (`fixed bottom-0 left-0 right-0 z-50`).
   - Include 4 navigation items with high-fidelity icons: Dashboard (`/dashboard`), Live Match (`/match/20260001`), My Bets (`/my-bets`), and Leaderboard (`/leaderboard`).
   - Use Next.js `usePathname` to apply active high-contrast text/icon states based on the current active route.
   - Inject this component into the root `app/layout.tsx` so it is globally available, but ensure it is hidden when the user is on the root Landing Page (`/`).

2. **Tournament Dashboard (`app/dashboard/page.tsx`):**
   - Build a clean dashboard with 3 categorical segment filters at the top: "LIVE", "UPCOMING", and "FINISHED".
   - Under "LIVE", render a prominent match card for our active fixture (`20260001` - Brazil vs Argentina). Show a flashing "LIVE" badge and make the entire card clickable, routing cleanly to `/match/20260001`.
   - Populate "UPCOMING" and "FINISHED" segments with realistic mock World Cup matches to showcase a complete production interface.

3. **User Predictions Ledger (`app/my-bets/page.tsx`):**
   - Create a user history ledger split into two tabs: "Active" and "Settled".
   - "Active" should display mock micro-predictions currently in progress, matching the 5-minute format from Phase 2.
   - "Settled" must show completed predictions with explicit green "WIN" or red "LOSS" states.
   - **TxLINE Verification Badge:** Every settled card must feature a distinct clickable badge labeled "Verified via TxLINE". Clicking it must toggle a clean collapsible UI drawer revealing a simulated cryptographic Merkle proof receipt (showing accurate root hash, sequence number, and verified stat primitives) to highlight trustless settlement.

4. **Leaderboard (`app/leaderboard/page.tsx`):**
   - Design a premium, high-contrast leaderboard table sorting top platform users.
   - Display column attributes for Rank, User/Wallet handle, total ROI (%), and a fire emoji "Hotstreak" counter (e.g., "🔥 5 streak").

5. **Landing Page Refactor (`app/page.tsx`):**
   - Refactor the current root page to act as a premium, sleek Web3 landing page for FlashBets.
   - Add a high-visibility Call-to-Action (CTA) button labeled "Enter Arena / Connect Wallet" that seamlessly routes the user to the `/dashboard`.

Ensure the entire navigation flow is fluid, matches our Zinc-950 dark theme, and compiles cleanly with zero TypeScript errors during `npm run build`.
