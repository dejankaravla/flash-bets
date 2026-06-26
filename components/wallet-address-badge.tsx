"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { truncateAddress } from "@/lib/wallet";

export function WalletAddressBadge() {
  const { connected, publicKey } = useWallet();

  if (!connected || !publicKey) return null;

  return (
    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-medium text-emerald-400">
      {truncateAddress(publicKey.toBase58())}
    </span>
  );
}
