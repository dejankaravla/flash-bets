import type { Program } from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  type TransactionSignature,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

import type { MicroMarket } from "@/lib/micro-markets";
import { formatWindowLabel } from "@/lib/micro-markets";
import {
  MIN_DEPOSIT_TOKENS,
  TOKEN_SCALE,
  TXL_MINT,
} from "@/lib/txoracle/constants";
import { nextIntentId } from "@/lib/txoracle/intent-id";
import {
  buildMarketIntentParams,
} from "@/lib/txoracle/market-terms";
import {
  writeBetDisplayCache,
  type BetDisplayCache,
} from "@/lib/txoracle/map-bet";
import {
  deriveIntentVaultPda,
  deriveOrderIntentPda,
} from "@/lib/txoracle/pdas";
import { buildTermsHash } from "@/lib/txoracle/terms-hash";
import { getCreateMakerAtaInstructionIfNeeded } from "@/lib/txoracle/token-account";
import { toUnixSecondsBn } from "@/lib/txoracle/time";

export interface CreateIntentParams {
  program: Program<Idl>;
  maker: PublicKey;
  connection: import("@solana/web3.js").Connection;
  fixtureId: number;
  market: MicroMarket;
  gameState: number;
  selection: "yes" | "no";
  amountTxl: number;
  estimatedMatchSeconds: number;
  matchLabel?: string;
}

export function estimateWindowEndMs(
  market: MicroMarket,
  estimatedMatchSeconds: number,
): number {
  const secondsUntilEnd = Math.max(
    60,
    market.windowEndSeconds - estimatedMatchSeconds,
  );
  return Date.now() + secondsUntilEnd * 1000;
}

export async function submitCreateIntent(
  params: CreateIntentParams,
): Promise<{ signature: TransactionSignature; orderIntentPda: string }> {
  const {
    program,
    maker,
    connection,
    fixtureId,
    market,
    gameState,
    selection,
    amountTxl,
    estimatedMatchSeconds,
    matchLabel,
  } = params;

  const depositAmount = Math.floor(amountTxl * TOKEN_SCALE);
  if (depositAmount < MIN_DEPOSIT_TOKENS) {
    throw new Error("Minimum deposit is 1 TxL");
  }

  const intentParams = buildMarketIntentParams(
    fixtureId,
    market,
    gameState,
    selection,
  );
  const termsHash = await buildTermsHash(program, intentParams);
  const intentId = await nextIntentId(program, maker);
  const orderIntentPda = deriveOrderIntentPda(maker, intentId);
  const intentVaultPda = deriveIntentVaultPda(orderIntentPda);

  const { ata: makerTokenAccount, instruction: ataIx } =
    await getCreateMakerAtaInstructionIfNeeded(connection, maker, maker);

  const estimatedWindowEndMs = estimateWindowEndMs(
    market,
    estimatedMatchSeconds,
  );

  const builder = program.methods
    .createIntent(
      intentId,
      Array.from(termsHash),
      new BN(depositAmount),
      toUnixSecondsBn(estimatedWindowEndMs),
      5,
      new BN(fixtureId),
    )
    .accounts({
      maker,
      orderIntent: orderIntentPda,
      intentVault: intentVaultPda,
      makerTokenAccount,
      tokenMint: TXL_MINT,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });

  if (ataIx) {
    builder.preInstructions([ataIx]);
  }

  const signature = await builder.rpc({ commitment: "confirmed" });

  const cache: BetDisplayCache = {
    matchLabel,
    proposition: market.proposition,
    windowLabel: formatWindowLabel(market.windowStart, market.windowEnd),
    selection: selection === "yes" ? "YES" : "NO",
  };
  writeBetDisplayCache(orderIntentPda.toBase58(), cache);

  return {
    signature,
    orderIntentPda: orderIntentPda.toBase58(),
  };
}

export function formatTxError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("User rejected")) {
      return "Transaction cancelled in wallet";
    }
    if (msg.toLowerCase().includes("insufficient")) {
      return "Insufficient TxL balance";
    }
    if (msg.includes("Minimum deposit")) {
      return msg;
    }
    return msg.length > 120 ? `${msg.slice(0, 120)}…` : msg;
  }
  return "Transaction failed";
}
