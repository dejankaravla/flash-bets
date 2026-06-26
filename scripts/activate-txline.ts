import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import axios from "axios";
import bs58 from "bs58";
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import nacl from "tweetnacl";

import idl from "../lib/idl/txoracle-devnet.json";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

const SERVICE_LEVEL_ID = 1;
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES: number[] = [];

const DEVNET_PROGRAM_ID = new PublicKey(
  "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
);
const DEVNET_TXL_MINT = new PublicKey(
  "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
);
const DEFAULT_RPC = "https://api.devnet.solana.com";
const DEFAULT_API_URL = "https://txline-dev.txodds.com";

function resolveWalletPath(): string {
  const raw =
    process.env.ANCHOR_WALLET ??
    path.join(os.homedir(), ".config", "solana", "id.json");

  if (raw.startsWith("~")) {
    return path.join(os.homedir(), raw.slice(1).replace(/^[/\\]/, ""));
  }

  return raw;
}

function keypairFromSecretBytes(secretBytes: Uint8Array): Keypair {
  if (secretBytes.length === 64) {
    return Keypair.fromSecretKey(secretBytes);
  }

  if (secretBytes.length === 32) {
    return Keypair.fromSeed(secretBytes);
  }

  throw new Error(
    `Invalid secret key length: ${secretBytes.length} bytes (expected 32 or 64)`,
  );
}

function keypairFromPrivateKeyString(raw: string): Keypair {
  const trimmed = raw.trim();

  if (trimmed.startsWith("[")) {
    const bytes = JSON.parse(trimmed) as number[];
    return keypairFromSecretBytes(Uint8Array.from(bytes));
  }

  return keypairFromSecretBytes(bs58.decode(trimmed));
}

function loadKeypairFromFile(walletPath: string): Keypair {
  if (!fs.existsSync(walletPath)) {
    throw new Error(
      `Wallet keypair not found at ${walletPath}. Set SOLANA_PRIVATE_KEY, ANCHOR_WALLET, or create a Solana CLI keypair.`,
    );
  }

  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8")) as number[];
  return keypairFromSecretBytes(Uint8Array.from(secret));
}

function loadWallet(): { keypair: Keypair; source: string } {
  const privateKeyEnv = process.env.SOLANA_PRIVATE_KEY?.trim();

  if (privateKeyEnv) {
    const keypair = keypairFromPrivateKeyString(privateKeyEnv);
    return { keypair, source: "SOLANA_PRIVATE_KEY" };
  }

  const walletPath = resolveWalletPath();
  const keypair = loadKeypairFromFile(walletPath);
  return { keypair, source: walletPath };
}

function assertPublicKeyMatches(keypair: Keypair): void {
  const expected = process.env.SOLANA_PUBLIC_KEY?.trim();
  if (!expected) return;

  const actual = keypair.publicKey.toBase58();
  if (actual !== expected) {
    throw new Error(
      `SOLANA_PUBLIC_KEY does not match SOLANA_PRIVATE_KEY (expected ${expected}, got ${actual})`,
    );
  }
}

function deriveProgramAccounts(programId: PublicKey, tokenMint: PublicKey) {
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    programId,
  );

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    programId,
  );

  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    tokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
  );

  return { tokenTreasuryPda, pricingMatrixPda, tokenTreasuryVault };
}

async function ensureUserTokenAccount(
  connection: Connection,
  payer: Keypair,
  owner: PublicKey,
  tokenMint: PublicKey,
): Promise<PublicKey> {
  const userTokenAccount = getAssociatedTokenAddressSync(
    tokenMint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const accountInfo = await connection.getAccountInfo(userTokenAccount);
  if (accountInfo) {
    return userTokenAccount;
  }

  console.log("Creating TxL associated token account...");
  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      userTokenAccount,
      owner,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );

  await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  return userTokenAccount;
}

function formatAxiosError(error: unknown, stage: string): never {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body =
      typeof error.response?.data === "string"
        ? error.response.data
        : JSON.stringify(error.response?.data ?? error.message);
    throw new Error(`[${stage}] HTTP ${status ?? "unknown"}: ${body}`);
  }

  throw error;
}

async function main(): Promise<void> {
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL?.trim() || DEFAULT_RPC;
  const apiBase = process.env.TXLINE_API_URL?.trim() || DEFAULT_API_URL;

  console.log("TxLINE activation (Devnet)");
  console.log(`RPC: ${rpcUrl}`);
  console.log(`API: ${apiBase}`);

  const { keypair, source } = loadWallet();
  assertPublicKeyMatches(keypair);

  console.log(`Wallet source: ${source}`);
  console.log(`Wallet address: ${keypair.publicKey.toBase58()}`);

  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  anchor.setProvider(provider);

  const program = new Program(idl as anchor.Idl, provider);
  const { tokenTreasuryPda, pricingMatrixPda, tokenTreasuryVault } =
    deriveProgramAccounts(DEVNET_PROGRAM_ID, DEVNET_TXL_MINT);

  const userTokenAccount = await ensureUserTokenAccount(
    connection,
    keypair,
    keypair.publicKey,
    DEVNET_TXL_MINT,
  );

  console.log("\nStep 1: On-chain subscribe (service level 12, 4 weeks)...");
  let txSig: string;

  try {
    txSig = await program.methods
      .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
      .accounts({
        user: keypair.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint: DEVNET_TXL_MINT,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } catch (error) {
    console.error("On-chain subscribe failed:", error);
    process.exit(1);
  }

  console.log(`Transaction signature: ${txSig}`);
  console.log(
    `Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
  );

  console.log("\nStep 2: Guest session...");
  let jwt: string;

  try {
    const authResponse = await axios.post(`${apiBase}/auth/guest/start`);
    jwt = authResponse.data.token as string;

    if (!jwt) {
      throw new Error("Guest session response missing token field");
    }
  } catch (error) {
    formatAxiosError(error, "guest session");
  }

  console.log("Guest JWT obtained.");

  console.log("\nStep 3: Sign activation message...");
  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const signatureBytes = nacl.sign.detached(
    new TextEncoder().encode(messageString),
    keypair.secretKey,
  );
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  console.log("\nStep 4: Activate API token...");
  let apiToken: string;

  try {
    const activationResponse = await axios.post(
      `${apiBase}/api/token/activate`,
      {
        txSig,
        walletSignature,
        leagues: SELECTED_LEAGUES,
      },
      {
        headers: { Authorization: `Bearer ${jwt}` },
      },
    );

    apiToken =
      (activationResponse.data?.token as string | undefined) ??
      (activationResponse.data as string);

    if (!apiToken || typeof apiToken !== "string") {
      throw new Error(
        `Unexpected activation response: ${JSON.stringify(activationResponse.data)}`,
      );
    }
  } catch (error) {
    formatAxiosError(error, "token activation");
  }

  console.log("\n=== TXLINE CREDENTIALS (copy to .env.local) ===");
  console.log(`TXLINE_API_URL=${apiBase}`);
  console.log(`TXLINE_JWT=${jwt}`);
  console.log(`TXLINE_API_TOKEN=${apiToken}`);
  console.log(
    "\nNote: TXLINE_JWT expires in ~30 days; re-run npm run activate-txline to refresh.",
  );
}

main().catch((error: unknown) => {
  console.error("\nActivation failed:", error);
  process.exit(1);
});
