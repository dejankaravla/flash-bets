import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

import { PROGRAM_ID, TXL_MINT } from "@/lib/txoracle/constants";

export function derivePricingMatrixPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    PROGRAM_ID,
  );
  return pda;
}

export function deriveTokenTreasuryPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    PROGRAM_ID,
  );
  return pda;
}

export function deriveOrderIntentPda(
  maker: PublicKey,
  intentId: BN | number | bigint,
): PublicKey {
  const intentIdBn = BN.isBN(intentId) ? intentId : new BN(intentId.toString());
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("order_intent"),
      maker.toBuffer(),
      intentIdBn.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID,
  );
  return pda;
}

export function deriveIntentVaultPda(orderIntent: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("intent_vault"), orderIntent.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}

export function deriveIntentVaultAta(orderIntent: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    TXL_MINT,
    orderIntent,
    true,
    TOKEN_2022_PROGRAM_ID,
  );
}
