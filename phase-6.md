### Context

Our live match data stream and dashboard are fully operational using real TxLINE API feeds. However, our betting mechanics currently use a temporary off-chain client-side `signMessage` loop, and the "My Bets" section relies on static mock data.

We have a complete Devnet Anchor IDL vendored at `scripts/idl/txoracle-devnet.json` for the program address `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`. We need to wire this IDL into our frontend client interactions to move the application fully on-chain.

### Task Instructions

1. **Setup Client-Side Anchor Provider:**
   - In our frontend wallet injection layers (or a dedicated hook like `lib/hooks/useAnchorProgram.ts`), initialize an Anchor `AnchorProvider` and a `Program` instance using the connected wallet from `@solana/wallet-adapter-react` and our vendored IDL. Target Solana Devnet.

2. **Refactor Prediction Form (`components/match/prediction-bottom-sheet.tsx`):**
   - Replace the off-chain `wallet.signMessage` call with a live on-chain transaction.
   - When a prediction is submitted, invoke the program's `createIntent` (or `createTrade` based on game logic) instruction.
   - Automatically derive all necessary program accounts required by the instruction schema (e.g., matching the `OrderIntent` layout: user wallet as `maker`, necessary matrix PDAs, and Token-2022 TxL mint parameters).
   - Show loading and error states during transaction submission, approval, and block confirmation phases.

3. **Hydrate Active Positions (`app/my-bets/page.tsx` or equivalent):**
   - Swap the static mock arrays for a live gPA (Get Program Accounts) or Anchor collection fetch.
   - Execute `program.account.orderIntent.all()` or `matchedTrade.all()`, applying a memcmp filter to isolate rows where the account's state matches the current user's `publicKey`.
   - Map the returned on-chain struct properties into our existing component prop shapes so that the UI updates dynamically whenever a bet is recorded or updated on-chain.

Run `npm run build` once complete to guarantee no type mismatches remain between our updated frontend Anchor interactions and the page router layouts.
