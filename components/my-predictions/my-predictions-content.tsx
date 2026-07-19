"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { PredictionCard } from "@/components/my-predictions/prediction-card";
import { usePredictions } from "@/lib/hooks/use-predictions";
import { useWalletAuth } from "@/lib/hooks/use-wallet-auth";

const FILTERS = ["ALL", "PENDING", "WON", "LOST", "REFUNDED", "VOID", "REPLAY", "LIVE"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABEL: Record<Filter, string> = {
  ALL: "All",
  PENDING: "Active",
  WON: "Won",
  LOST: "Lost",
  REFUNDED: "Refunded",
  VOID: "Void",
  REPLAY: "Replay",
  LIVE: "Live",
};

export function MyPredictionsContent() {
  const { connected } = useWallet();
  const { authenticated, loading: authLoading, signIn } = useWalletAuth();
  const { predictions, flashPoints, loading, error, refresh } = usePredictions();
  const [filter, setFilter] = useState<Filter>("ALL");
  const filtered = useMemo(() => [...predictions]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .filter((prediction) => {
      if (filter === "ALL") return true;
      if (filter === "PENDING") return prediction.status === "PENDING" || prediction.status === "LOCKED";
      if (filter === "REPLAY" || filter === "LIVE") return (prediction.market?.sourceMode ?? "LIVE") === filter;
      if (filter === "REFUNDED") return prediction.status === "REFUNDED" || prediction.refund > 0;
      return prediction.status === filter;
    }), [filter, predictions]);

  return (
    <main className="mx-auto min-h-[calc(100vh-7rem)] min-h-[calc(100dvh-7rem)] w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Wallet history</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">My Predictions</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Newest first · live and replay outcomes · permanent settlement receipts</p>
        </div>
        {authenticated && <Link href="/dashboard" className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-bold text-zinc-950 hover:bg-emerald-400">Make a prediction</Link>}
      </header>

      {!connected ? (
        <section className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/60 px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300" aria-hidden><svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h13a3 3 0 010 6H4V7zm0 0V5h13m0 8v4H4v-4m13-3h.01" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <h2 className="mt-4 text-xl font-semibold text-zinc-100">Connect your wallet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">Your wallet identifies which predictions and receipts belong to you. Connecting does not create a transaction.</p>
          <div className="mt-6 flex justify-center"><WalletMultiButton /></div>
        </section>
      ) : !authenticated ? (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 px-6 py-10 text-center">
          <h2 className="text-xl font-semibold text-zinc-100">Sign in to open your history</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">Sign one wallet message to load your FlashPoints, predictions, and settlement receipts.</p>
          <button type="button" disabled={authLoading} onClick={() => void signIn()} className="mt-6 min-h-12 rounded-xl bg-emerald-500 px-6 font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">{authLoading ? "Waiting for signature…" : "Sign in with wallet"}</button>
        </section>
      ) : (
        <>
          {flashPoints && (
            <section className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-800 sm:grid-cols-4" aria-label="FlashPoints account">
              {[
                ["Available", flashPoints.available, "text-emerald-300"],
                ["Locked", flashPoints.locked, "text-amber-200"],
                ["Awarded", flashPoints.won, "text-zinc-100"],
                ["Refunded", flashPoints.refunded, "text-violet-200"],
              ].map(([label, value, tone]) => <div key={label} className="bg-zinc-900 px-4 py-4 sm:px-5"><p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p><p className="mt-0.5 text-[11px] text-zinc-600">FlashPoints</p></div>)}
            </section>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Prediction filters">
            {FILTERS.map((value) => {
              const selected = filter === value;
              return <button key={value} type="button" aria-pressed={selected} onClick={() => setFilter(value)} className={`min-h-11 rounded-full px-4 text-xs font-bold transition-colors ${selected ? "bg-emerald-500 text-zinc-950" : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"}`}>{FILTER_LABEL[value]}</button>;
            })}
            {loading && predictions.length > 0 && <span role="status" className="ml-auto shrink-0 text-xs text-zinc-500">Updating…</span>}
          </div>

          {error && (
            <section role="alert" className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-4 text-sm text-red-200">
              <h2 className="font-semibold text-red-100">Prediction history is unavailable</h2>
              <p className="mt-1">{error}</p>
              <button type="button" onClick={() => void refresh()} className="mt-4 min-h-11 rounded-lg border border-red-300/30 px-3 text-xs font-bold hover:bg-red-500/10">Try again</button>
            </section>
          )}

          {loading && predictions.length === 0 && (
            <div className="mt-5 space-y-4" aria-busy="true">
              {[0, 1].map((item) => <div key={item} className="h-48 rounded-3xl border border-zinc-800 bg-zinc-900 p-5" aria-hidden><div className="skeleton h-3 w-32 rounded" /><div className="skeleton mt-4 h-5 w-3/4 rounded" /><div className="skeleton mt-8 h-4 w-full rounded" /><div className="skeleton mt-3 h-4 w-2/3 rounded" /></div>)}
              <p role="status" className="sr-only">Loading predictions</p>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-4">
            {!loading && !error && filtered.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/50 px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-zinc-100">{predictions.length === 0 ? "No predictions yet" : `No ${FILTER_LABEL[filter].toLowerCase()} predictions`}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">{predictions.length === 0 ? "Choose an open Goal or Corner market. Your active prediction and eventual receipt will appear here automatically." : "Choose another filter to review the rest of your history."}</p>
                {predictions.length === 0 && <Link href="/dashboard" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-500 px-4 text-sm font-bold text-zinc-950 hover:bg-emerald-400">Browse matches</Link>}
              </section>
            ) : filtered.map((prediction) => <PredictionCard key={prediction.predictionId} prediction={prediction} />)}
          </div>
        </>
      )}
    </main>
  );
}
