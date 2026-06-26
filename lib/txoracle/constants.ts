import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
);

export const TXL_MINT = new PublicKey(
  "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
);

export const TOKEN_DECIMALS = 6;
export const MIN_DEPOSIT_TOKENS = 1_000_000;
export const TOKEN_SCALE = 10 ** TOKEN_DECIMALS;

export const DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC?.trim() || clusterApiUrl("devnet");

export const BET_DISPLAY_CACHE_KEY = "flash-bets:bet-display-cache";
