import { BN } from "@coral-xyz/anchor";

export function toUnixSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

export function toUnixSecondsBn(ms: number): BN {
  return new BN(toUnixSeconds(ms));
}
