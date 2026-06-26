import type { Program } from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

import { ORDER_INTENT_MAKER_OFFSET } from "@/lib/txoracle/account-layout";
import { getProgramAccounts } from "@/lib/txoracle/program-accounts";
import { toUnixSeconds } from "@/lib/txoracle/time";

export async function nextIntentId(
  program: Program<Idl>,
  maker: PublicKey,
): Promise<BN> {
  try {
    const accounts = getProgramAccounts(program);
    const rows = await accounts.orderIntent.all([
      {
        memcmp: {
          offset: ORDER_INTENT_MAKER_OFFSET,
          bytes: maker.toBase58(),
        },
      },
    ]);

    if (rows.length === 0) {
      return new BN(1);
    }

    const maxId = rows.reduce((max, row) => {
      const intent = row.account as { intentId: BN };
      const id = intent.intentId;
      return id.gt(max) ? id : max;
    }, new BN(0));

    return maxId.add(new BN(1));
  } catch {
    return new BN(toUnixSeconds(Date.now()));
  }
}
