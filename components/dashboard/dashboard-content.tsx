"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

import type { FlashBetsMode } from "@/lib/app-mode";
import { FixtureCard } from "@/components/dashboard/fixture-card";
import { SegmentFilter } from "@/components/dashboard/segment-filter";
import { readApiError } from "@/lib/client-errors";
import { useWalletAuth } from "@/lib/hooks/use-wallet-auth";
import { getFixturesBySegment, type DashboardFixture, type DashboardSegment } from "@/lib/types/dashboard";
import type { ReplayState } from "@/lib/replay/types";

interface DashboardContentProps {
  fixtures: DashboardFixture[];
  txLineConfigured: boolean;
  mode: FlashBetsMode;
  sourceError?: string;
}

function EmptyFixtures({
  mode,
  message,
  onRetry,
}: {
  mode: FlashBetsMode;
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="col-span-full rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/50 px-6 py-12 text-center">
      <span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${mode === "REPLAY" ? "bg-violet-500/15 text-violet-300" : "bg-emerald-500/15 text-emerald-300"}`} aria-hidden>
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M7 4v6m10-6v6M5 11h14v9H5z" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <h2 className="mt-4 text-lg font-semibold text-zinc-100">Nothing to open here yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">{message}</p>
      <button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800">
        Check again
      </button>
    </section>
  );
}

export function DashboardContent({ fixtures, txLineConfigured, mode, sourceError }: DashboardContentProps) {
  const router = useRouter();
  const { connected } = useWallet();
  const { authenticated, signIn } = useWalletAuth();
  const [segment, setSegment] = useState<DashboardSegment>(mode === "REPLAY" ? "replay" : "live");
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(() => getFixturesBySegment(fixtures, segment), [fixtures, segment]);

  const chooseReplay = async (replayId: string) => {
    setError(null);
    if (!connected) {
      setError("Connect your wallet from the top bar before choosing a replay.");
      return;
    }
    if (!authenticated && !(await signIn())) {
      setError("Sign in with your wallet, then choose the replay again.");
      return;
    }

    setSelecting(replayId);
    try {
      const response = await fetch("/api/replays/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replayId }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "The replay could not be prepared. Try again."));
      const payload = (await response.json()) as { state?: ReplayState };
      if (!payload.state) throw new Error("The replay could not be prepared. Try again.");
      router.push(`/match/${payload.state.fixtureId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The replay could not be prepared. Try again.");
    } finally {
      setSelecting(null);
    }
  };

  const emptyMessage = sourceError
    ? "The match source is temporarily unavailable. Check the server configuration, then try again."
    : !txLineConfigured
      ? "Live match credentials are not configured. Switch the server to Replay Mode for the self-contained demo."
      : fixtures.length === 0
        ? mode === "REPLAY"
          ? "No replay datasets are available. Restore the packaged replay files and refresh."
          : "TxLINE returned no fixtures. Live schedules can be quiet between match windows."
        : segment === "finished"
          ? "Finished matches and completed replay runs will appear here."
          : segment === "unavailable"
            ? "Fixtures without a trustworthy source state will appear here instead of looking live."
            : `There are no ${segment.toLowerCase()} matches right now. Choose another category or check again.`;

  return (
    <main className="mx-auto min-h-[calc(100vh-7rem)] min-h-[calc(100dvh-7rem)] w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.2em] ${mode === "REPLAY" ? "text-violet-300" : "text-emerald-400"}`}>
            {mode === "REPLAY" ? "Replay library" : "Live football"}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            {mode === "REPLAY" ? "Choose a demo match" : "Choose a match"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            {mode === "REPLAY"
              ? "Select a historical TxLINE replay, place a prediction while paused, then watch it settle automatically."
              : "Open an in-play fixture with fresh TxLINE data to see its five-minute markets."}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
          <span className="font-semibold text-zinc-200">{fixtures.length}</span> {fixtures.length === 1 ? "fixture" : "fixtures"} available
        </div>
      </header>

      <SegmentFilter active={segment} onChange={setSegment} mode={mode} />

      {(error || sourceError) && (
        <div role="alert" className="mt-5 flex items-start justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <p className="min-w-0 break-words">{error || emptyMessage}</p>
          <button type="button" onClick={() => sourceError ? router.refresh() : setError(null)} aria-label={sourceError ? "Retry loading fixtures" : "Dismiss message"} className="min-h-11 min-w-11 shrink-0 rounded-lg border border-red-300/20 px-2.5 text-xs font-bold text-red-100 hover:bg-red-500/15">{sourceError ? "Retry" : "×"}</button>
        </div>
      )}
      {selecting && <p role="status" className="sr-only">Preparing replay</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {filtered.length === 0 ? (
          <EmptyFixtures mode={mode} message={emptyMessage} onRetry={() => router.refresh()} />
        ) : (
          filtered.map((fixture) => (
            <FixtureCard
              key={`${fixture.replayId ?? "live"}:${fixture.id}`}
              fixture={fixture}
              selecting={selecting === fixture.replayId}
              onReplaySelect={fixture.replayId ? chooseReplay : undefined}
            />
          ))
        )}
      </div>
    </main>
  );
}
