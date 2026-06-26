import type { Program } from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";

import {
  toAnchorMarketIntentParams,
  type MarketIntentParams,
} from "@/lib/txoracle/market-terms";

async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
  return new Uint8Array(digest);
}

export async function buildTermsHash(
  program: Program<Idl>,
  params: MarketIntentParams,
): Promise<Uint8Array> {
  const encoded = program.coder.types.encode(
    "MarketIntentParams",
    toAnchorMarketIntentParams(params),
  );
  return sha256Bytes(encoded);
}

export function termsHashPrefix(termsHash: number[] | Uint8Array): string {
  const bytes = Array.from(termsHash);
  const hex = bytes
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}
