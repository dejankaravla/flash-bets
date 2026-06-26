### Context & Objective

We are entering Phase 4 (The Final Frontend Phase): Integrating the **Official Solana Wallet Adapter** to transform our mock flows into a functioning Web3 decentralized application (dApp).
**Path Enforcement:** There is NO `src/` directory. All components and contexts must be strictly placed within root-level folders (`app/`, `components/`, etc.).

### Detailed Task Instructions

1. **Create Solana Wallet Provider (`components/solana-wallet-provider.tsx`):**
   - Create a client-side wrapper component named `SolanaWalletProvider`.
   - Setup `@solana/wallet-adapter-react` and UI context providers incorporating `ConnectionProvider`, `WalletProvider`, and `WalletModalProvider`.
   - Hardcode the cluster network to Solana `devnet`. Configure default standard wallet adapters (Phantom, Solflare).
   - Inject this provider into the root `app/layout.tsx` inside the `<NavShell>`, ensuring the entire application has access to the active wallet context.

2. **Refactor Landing Page Auth Flow (`app/page.tsx`):**
   - Replace the cosmetic CTA link from Phase 3 with the official `@solana/wallet-adapter-react-ui` connection button (custom-styled with Tailwind to match our premium zinc-950/emerald-400 theme).
   - Implement a React `useEffect` hook monitoring the `connected` state from `useWallet()`. The moment `connected` becomes true, trigger a seamless route redirect using Next.js `useRouter` to push the user straight to `/dashboard`.

3. **Dynamic Wallet Header State (`components/match/live-match-header.tsx`):**
   - Import `useWallet` into the match header and global UI sections.
   - If a wallet is active, dynamically replace generic status text with a beautifully truncated slice of the user's public key (e.g., `Ab3X...9Z1p`).

4. **Live Wallet Signing inside Prediction Modal (`components/match/prediction-bottom-sheet.tsx`):**
   - Update the "Confirm Prediction via Wallet" action flow.
   - Before firing the success toast, inspect the wallet context. If no wallet is connected, gracefully alert the user.
   - If connected, invoke the native `signMessage` or transaction window from the connected wallet provider. The app must block the UI with an authentic state ("Awaiting Wallet Signature...").
   - Once the cryptographic response is successfully returned from the user's extension/app, close the bottom sheet, trigger our custom success toast component, and log the success state safely.

5. **Theme Cleanup & Review:**
   - Ensure the standard injected library styles from `@solana/wallet-adapter-react-ui/styles.css` are correctly imported and do not disrupt our customized dark theme layout bounds.

Run a complete `npm run build` pass to verify there are zero server-side pre-rendering errors or broken hooks.
