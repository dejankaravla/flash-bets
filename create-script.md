### Context & Objective

We are initiating Phase 5 (Production Data Swap) for our TxLINE integration. According to the official TxLINE World Cup documentation, we cannot get an API key via a simple web dashboard. Instead, we must perform an on-chain registration using a Solana wallet, request a guest session, cryptographically sign a validation payload, and activate our token via their API.

We need to create a standalone TypeScript script at `scripts/activate-txline.ts` that handles this 4-step activation process end-to-end and prints out our final production API token.

### Task Instructions

1. **Install Missing Activation Dependencies:**
   - Ensure `tweetnacl` and `axios` are installed in the project workspace alongside `@solana/web3.js` and `@coral-xyz/anchor`.

2. **Create the Activation Script (`scripts/activate-txline.ts`):**
   - Write a standalone node script using TypeScript execution handles (e.g., compatible with `ts-node` or `tsx`).
   - **Wallet Setup:** Configure the script to read a local Solana Keypair. It should look for a private key array or file path from an environment variable like `ANCHOR_WALLET` or a temporary local configuration so it can sign both the Solana transaction and the off-chain message.
   - **Step 1: On-Chain Subscription:**
     - Initialize the connection to Solana Mainnet or Devnet (per current TxLINE program deployment rules).
     - Target the TxLINE Anchor Program and invoke the `.subscribe(12, 4)` method.
     - _Note:_ Service Level `12` is required for Free World Cup & International Friendlies in **Real-Time** (Level 1 has a 60-second delay). Set duration to `4` weeks.
     - Execute the transaction via `.rpc()` and capture the resulting Transaction Signature string (`txSig`).
   - **Step 2: Start Guest Session:**
     - Make an HTTP POST request to `https://txline.txodds.com/auth/guest/start`.
     - Extract the short-lived guest session token (`jwt`) from the response payload.
   - **Step 3: Cryptographic Payload Signing:**
     - Build the strict message string required by the API: `${txSig}::${jwt}` (leaving the selected leagues empty as it is standard for the World Cup bundle).
     - Convert this string into a `Uint8Array` using `TextEncoder`.
     - Sign this message using `nacl.sign.detached` with the wallet's secret key.
     - Encode the resulting signature bytes into a `base64` string format (`walletSignature`).
   - **Step 4: API Token Activation:**
     - Send a POST request to `https://txline.txodds.com/api/token/activate`.
     - Pass the `Authorization: Bearer ${jwt}` header using the temporary guest token.
     - Send the JSON body containing: `{ txSig, walletSignature, leagues: [] }`.
   - **Output Handling:**
     - Gracefully catch errors at any stage (failed transaction, invalid signature structure).
     - Upon a successful 200 OK response from the activation endpoint, extract the permanent `apiToken`.
     - Print a bold, visible log in the terminal terminal: `=== YOUR TXLINE PRODUCTION API TOKEN ===` followed by the actual string, instructing the operator to copy it into `.env.local` as `TXLINE_JWT`.

3. **Verify Configuration Layer:**
   - Ensure this script doesn't pollute or alter any of our client-side runtime configurations or Next.js pages. It must remain a server-side, build-ignored utility script.
