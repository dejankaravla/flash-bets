"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { readApiError } from "@/lib/client-errors";
import { REPLAY_SPEEDS, type ReplayState } from "@/lib/replay/types";

function formatReplayTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ReplayControls({ state, onState }: { state: ReplayState; onState: (state: ReplayState) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmRestart) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmRestart(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [confirmRestart]);

  const control = async (action: "PLAY" | "PAUSE" | "RESTART" | "SPEED", speed?: number) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/replays/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, speed }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "The replay control did not respond. Try again."));
      const payload = (await response.json()) as { state?: ReplayState };
      if (!payload.state) throw new Error("The replay control did not respond. Try again.");
      onState(payload.state);
      if (action === "RESTART" && payload.state.fixtureId !== state.fixtureId) {
        router.replace(`/match/${payload.state.fixtureId}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The replay control did not respond. Try again.");
    } finally {
      setBusy(false);
      setConfirmRestart(false);
    }
  };

  const finished = state.status === "FINISHED";

  return (
    <section className="border-b border-violet-400/20 bg-gradient-to-r from-violet-950/30 via-zinc-950 to-violet-950/20" aria-labelledby="replay-controls-title">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Replay control</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${finished ? "bg-emerald-500/15 text-emerald-200" : state.status === "PLAYING" ? "bg-violet-500/20 text-violet-100" : "bg-zinc-800 text-zinc-300"}`}>{finished ? "Finished" : state.status}</span>
            </div>
            <h2 id="replay-controls-title" className="mt-1 text-base font-semibold text-zinc-50">{state.title}</h2>
            <p className="mt-1 text-xs text-zinc-400">{state.competition} · historical TxLINE data</p>
          </div>
          <p className="font-mono text-sm tabular-nums text-zinc-200" aria-label={`Replay time ${formatReplayTime(state.currentTimeMs)} of ${formatReplayTime(state.durationMs)}`}>
            {formatReplayTime(state.currentTimeMs)} <span className="text-zinc-600">/</span> {formatReplayTime(state.durationMs)}
          </p>
        </div>

        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-label="Replay progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state.progress * 100)}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-[width] duration-500" style={{ width: `${Math.round(state.progress * 100)}%` }} />
        </div>

        {finished ? (
          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-emerald-100">Replay finished</p>
              <p className="mt-1 text-sm text-emerald-100/70">Automatic settlement continues in the background. Open My Predictions to see completed receipts.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirmRestart(true)} className="min-h-11 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-zinc-950 hover:bg-emerald-200 disabled:opacity-50">Restart replay</button>
              <Link href="/dashboard" className="flex min-h-11 items-center rounded-xl border border-emerald-300/30 px-4 text-xs font-bold text-emerald-100 hover:bg-emerald-500/10">Choose another</Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void control(state.status === "PLAYING" ? "PAUSE" : "PLAY")} className="min-h-11 min-w-24 rounded-xl bg-violet-500 px-4 text-xs font-bold text-white shadow-lg shadow-violet-950/30 hover:bg-violet-400 disabled:opacity-40">
                {busy ? "Working…" : state.status === "PLAYING" ? "Pause" : "Play replay"}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmRestart(true)} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">Restart</button>
            </div>
            <div className="w-full sm:ml-auto sm:w-auto">
              <span className="mb-2 block text-xs text-zinc-500">Speed</span>
              <div className="grid grid-cols-5 gap-1" aria-label="Replay speed">
                {REPLAY_SPEEDS.map((speed) => (
                  <button key={speed} type="button" disabled={busy} aria-pressed={state.speed === speed} aria-label={`${speed} times replay speed`} onClick={() => void control("SPEED", speed)} className={`min-h-11 min-w-0 rounded-lg px-1 text-xs font-bold transition-colors ${state.speed === speed ? "bg-violet-300 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{speed}×</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {busy && <p role="status" className="mt-3 text-xs text-violet-200">Updating replay…</p>}
        {error && <p role="alert" className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      </div>

      {confirmRestart && (
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmRestart(false)}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="restart-title" aria-describedby="restart-description" className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">New replay run</p>
            <h2 id="restart-title" className="mt-2 text-xl font-semibold text-zinc-50">Restart this replay?</h2>
            <p id="restart-description" className="mt-3 text-sm leading-6 text-zinc-400">Unfinished markets from this run will be voided, locked FlashPoints will be refunded, and permanent receipts will be created before a fresh run starts.</p>
            <div className="mt-6 flex gap-3">
              <button ref={confirmButtonRef} type="button" disabled={busy} onClick={() => void control("RESTART")} className="min-h-11 flex-1 rounded-xl bg-violet-500 px-4 text-sm font-bold text-white hover:bg-violet-400 disabled:opacity-50">Restart run</button>
              <button type="button" disabled={busy} onClick={() => setConfirmRestart(false)} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 hover:bg-zinc-800">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
