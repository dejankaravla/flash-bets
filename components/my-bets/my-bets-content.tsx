"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";

import { BetCard } from "@/components/my-bets/bet-card";
import { BetTabs } from "@/components/my-bets/bet-tabs";
import { useUserBets } from "@/lib/hooks/use-user-bets";

export function MyBetsContent() {
  const [tab, setTab] = useState<"active" | "settled">("active");
  const { connected } = useWallet();
  const { activeBets, settledBets, isLoading, error } = useUserBets();
  const bets = tab === "active" ? activeBets : settledBets;

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-zinc-950 px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">My Bets</h1>
        <p className="mt-1 text-sm text-zinc-500">Your on-chain micro-predictions</p>
      </header>

      <BetTabs active={tab} onChange={setTab} />

      {!connected && (
        <p className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-400">
          Connect your wallet to view on-chain positions
        </p>
      )}

      {connected && error && (
        <p className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {connected && isLoading && bets.length === 0 && (
        <p className="mt-6 py-8 text-center text-sm text-zinc-500">
          Loading on-chain bets…
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {connected && !isLoading && bets.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-zinc-500">No bets found</p>
        ) : (
          bets.map((bet) => <BetCard key={bet.id} bet={bet} />)
        )}
      </div>
    </div>
  );
}
