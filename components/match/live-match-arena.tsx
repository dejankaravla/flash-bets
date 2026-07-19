"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import type { FlashBetsMode } from "@/lib/app-mode";
import { LiveMatchHeader } from "@/components/match/live-match-header";
import { MicroMarketCard } from "@/components/match/micro-market-card";
import { PredictionBottomSheet } from "@/components/match/prediction-bottom-sheet";
import { ReplayControls } from "@/components/match/replay-controls";
import type { Market } from "@/lib/domain/flash-bets";
import { useCanonicalMarkets } from "@/lib/hooks/use-canonical-markets";
import { useTxLineStream } from "@/lib/hooks/use-txline-stream";

function MatchConnecting({ mode }: { mode: FlashBetsMode }) {
  return (
    <main className="mx-auto min-h-[60vh] w-full max-w-5xl px-4 py-8 sm:px-6" aria-busy="true">
      <p className="text-sm font-medium text-zinc-300">Connecting to {mode === "REPLAY" ? "the replay" : "live match data"}…</p>
      <p className="mt-1 text-sm text-zinc-500">The score, clock, and open windows will appear together.</p>
      <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="skeleton mx-auto h-4 w-44 rounded" />
        <div className="skeleton mx-auto mt-5 h-10 w-28 rounded-lg" />
        <div className="skeleton mx-auto mt-4 h-4 w-32 rounded" />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[0, 1].map((item) => <div key={item} className="h-36 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><div className="skeleton h-3 w-28 rounded" /><div className="skeleton mt-4 h-5 w-3/4 rounded" /><div className="skeleton mt-8 h-4 w-full rounded" /></div>)}
      </div>
      <p role="status" className="sr-only">Connecting to match data</p>
    </main>
  );
}

export function LiveMatchArena({ fixtureId, mode }: { fixtureId: string; mode: FlashBetsMode }) {
  const { scores, status, replayState, setReplayState, retry } = useTxLineStream(fixtureId);
  const {
    markets,
    fixtureFresh,
    isLoading: marketsLoading,
    error: marketsError,
    refresh: refreshMarkets,
  } = useCanonicalMarkets(fixtureId, scores?.seq ?? null);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const closePrediction = useCallback(() => setSelectedMarket(null), []);

  if (status === "connecting" && !scores) return <MatchConnecting mode={mode} />;
  if (!scores) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center px-5 py-12 text-center">
        <section className="w-full rounded-3xl border border-amber-500/25 bg-amber-500/10 px-6 py-10">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-200" aria-hidden>!</span>
          <h1 className="mt-4 text-2xl font-semibold text-zinc-50">Match data is unavailable</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-300">
            {mode === "REPLAY"
              ? "This replay run ended or another replay replaced it. Choose a replay again to create a fresh run."
              : "FlashBets could not receive a trustworthy update for this fixture. It may not be live, or TxLINE may be reconnecting."}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={retry} className="min-h-11 rounded-xl bg-amber-300 px-5 text-sm font-bold text-zinc-950 hover:bg-amber-200">Try connection again</button>
            <Link href="/dashboard" className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 px-5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800">Choose another match</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <LiveMatchHeader scores={scores} fixtureFresh={fixtureFresh} mode={mode} />
      {mode === "REPLAY" && replayState && <ReplayControls state={replayState} onState={setReplayState} />}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Prediction board</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-50">Five-minute markets</h2>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900">← Matches</Link>
        </div>

        {(status === "error" || status === "closed") && (
          <div role="status" className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            <p>Reconnecting to the match stream. The latest score remains visible, but markets stay locked if data becomes stale.</p>
            <button type="button" onClick={retry} className="shrink-0 rounded-lg border border-amber-300/30 px-3 py-1.5 text-xs font-bold hover:bg-amber-300/10">Retry</button>
          </div>
        )}
        {!fixtureFresh && (
          <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            {mode === "REPLAY" ? "Replay data is delayed." : "Live match data is delayed."} Predictions remain locked until a fresh update arrives.
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {markets.map((market) => <MicroMarketCard key={market.marketId} market={market} onSelect={setSelectedMarket} />)}
          {marketsLoading && markets.length === 0 && [0, 1].map((item) => <div key={item} className="h-36 rounded-3xl border border-zinc-800 bg-zinc-900 p-5" aria-hidden><div className="skeleton h-3 w-28 rounded" /><div className="skeleton mt-4 h-5 w-3/4 rounded" /><div className="skeleton mt-8 h-4 w-full rounded" /></div>)}
          {marketsError && (
            <section className="col-span-full rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-5 text-sm text-red-200">
              <h3 className="font-semibold text-red-100">Markets could not be loaded</h3>
              <p className="mt-1">{marketsError}</p>
              <button type="button" onClick={() => void refreshMarkets()} className="mt-4 min-h-10 rounded-lg border border-red-300/30 px-3 text-xs font-bold hover:bg-red-500/10">Try again</button>
            </section>
          )}
          {!marketsLoading && !marketsError && markets.length === 0 && (
            <section className="col-span-full rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/60 px-6 py-10 text-center">
              <h3 className="text-lg font-semibold text-zinc-100">No prediction window is open</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-400">Markets appear only during fresh first- or second-half data. If the match is paused, at halftime, or finished, wait for the next eligible state or choose another match.</p>
            </section>
          )}
        </div>
        <div className="h-16 md:h-8" />
      </main>
      {selectedMarket && <PredictionBottomSheet market={selectedMarket} onClose={closePrediction} />}
    </div>
  );
}
