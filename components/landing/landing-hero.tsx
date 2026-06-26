"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function LandingHero() {
  const { connected } = useWallet();
  const router = useRouter();
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (connected) {
      router.push("/dashboard");
    }
  }, [connected, router]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-zinc-950"
        aria-hidden
      />

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
          FlashBets
        </p>
        <h1 className="mt-4 max-w-sm text-4xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
          Micro-predictions for the World Cup
        </h1>
        <p className="mt-4 max-w-md text-lg text-zinc-400">
          High-frequency decentralized markets on Solana. Bet on 5-minute windows
          with TxLINE-verified settlement.
        </p>

        <ul className="mt-10 flex max-w-sm flex-col gap-3 text-left text-sm text-zinc-400">
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              ⚡
            </span>
            Live rolling micro-markets every 5 minutes
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              ✓
            </span>
            Trustless settlement via TxLINE Merkle proofs
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              $
            </span>
            USDC pools with real-time YES/NO allocation
          </li>
        </ul>

        <div className="mt-12">
          {hasMounted ? (
            <WalletMultiButton className="!rounded-full !bg-emerald-500 !px-8 !py-4 !text-base !font-bold !text-white !shadow-lg !shadow-emerald-500/25 hover:!bg-emerald-400" />
          ) : (
            <button
              type="button"
              disabled
              className="rounded-full bg-emerald-500 px-8 py-4 text-base font-bold text-white opacity-80 shadow-lg shadow-emerald-500/25"
            >
              Select Wallet
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
