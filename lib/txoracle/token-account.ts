import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";

import { TXL_MINT } from "@/lib/txoracle/constants";

export function getMakerTokenAccount(maker: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    TXL_MINT,
    maker,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
}

export async function getCreateMakerAtaInstructionIfNeeded(
  connection: Connection,
  payer: PublicKey,
  maker: PublicKey,
): Promise<{ ata: PublicKey; instruction: TransactionInstruction | null }> {
  const ata = getMakerTokenAccount(maker);
  const info = await connection.getAccountInfo(ata);

  if (info) {
    return { ata, instruction: null };
  }

  const instruction = createAssociatedTokenAccountInstruction(
    payer,
    ata,
    maker,
    TXL_MINT,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  return { ata, instruction };
}
