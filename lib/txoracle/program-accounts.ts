import type { Program } from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";

interface AccountRow<T> {
  publicKey: PublicKey;
  account: T;
}

interface MemcmpFilter {
  memcmp: {
    offset: number;
    bytes: string;
  };
}

interface ProgramAccounts {
  orderIntent: {
    all: (filters: MemcmpFilter[]) => Promise<AccountRow<Record<string, unknown>>[]>;
  };
  matchedTrade: {
    all: (filters: MemcmpFilter[]) => Promise<AccountRow<Record<string, unknown>>[]>;
  };
}

export function getProgramAccounts(program: Program<Idl>): ProgramAccounts {
  return program.account as unknown as ProgramAccounts;
}
