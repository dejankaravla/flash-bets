"use client";

import { useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { useWalletAuth } from "@/lib/hooks/use-wallet-auth";
import { truncateAddress } from "@/lib/wallet";

export function WalletAddressBadge() {
  const { connected, publicKey } = useWallet();
  const { authenticated, user, loading, signIn, signOut } = useWalletAuth();
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!hasMounted) {
    return (
      <button type="button" disabled className="min-h-11 rounded-full border border-zinc-700 px-3 text-xs font-semibold text-zinc-500">
        Wallet
      </button>
    );
  }
  if (!connected || !publicKey) {
    return (
      <WalletMultiButton className="!h-11 !min-h-11 !whitespace-nowrap !rounded-full !bg-emerald-500 !px-3 !text-xs !font-bold !text-zinc-950 hover:!bg-emerald-400" />
    );
  }
  if (!authenticated || !user) {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => void signIn()}
        className="min-h-11 rounded-full border border-emerald-500/40 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
      >
        {loading ? "Checking…" : "Sign in"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      title="Sign out of FlashBets"
      className="flex min-h-11 max-w-[calc(100vw-5.5rem)] min-w-0 items-center rounded-full bg-emerald-500/15 px-3 text-right text-xs text-emerald-300 transition-colors hover:bg-emerald-500/25"
    >
      <span className="shrink-0 font-mono">{truncateAddress(publicKey.toBase58())}</span>
      <span className="ml-2 truncate font-semibold">{user.flashPoints.available} FP</span>
    </button>
  );
}
