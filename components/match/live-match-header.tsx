"use client";

import type { FlashBetsMode } from "@/lib/app-mode";
import type { MatchPhase } from "@/lib/domain/flash-bets";
import { STAT_KEY, type TxLineScoresUpdate } from "@/lib/types/txline";

const PHASE_LABEL: Record<MatchPhase, string> = {
  NOT_STARTED: "Not started",
  FIRST_HALF: "First half",
  HALFTIME: "Halftime",
  SECOND_HALF: "Second half",
  FINISHED: "Full time",
  SUSPENDED: "Suspended",
  POSTPONED: "Postponed",
  ABANDONED: "Abandoned",
  UNKNOWN: "Status unavailable",
};

export function LiveMatchHeader({ scores, fixtureFresh, mode }: { scores: TxLineScoresUpdate; fixtureFresh: boolean; mode: FlashBetsMode }) {
  const homeGoals = scores.stats[STAT_KEY.P1_GOALS];
  const awayGoals = scores.stats[STAT_KEY.P2_GOALS];
  const isInPlay = fixtureFresh && (scores.matchPhase === "FIRST_HALF" || scores.matchPhase === "SECOND_HALF");

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6">
        <div className="flex items-center justify-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${isInPlay ? mode === "REPLAY" ? "bg-violet-500/15 text-violet-200" : "bg-red-500/15 text-red-300" : "bg-zinc-800 text-zinc-300"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isInPlay ? mode === "REPLAY" ? "bg-violet-400" : "animate-pulse bg-red-400" : "bg-zinc-500"}`} />
            {isInPlay ? mode === "REPLAY" ? "Replay in progress" : "Live" : PHASE_LABEL[scores.matchPhase]}
          </span>
          {!fixtureFresh && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold uppercase text-amber-200">Data delayed</span>}
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-8">
          <p className="truncate text-right text-sm font-semibold text-zinc-200 sm:text-base" title={scores.participants[0]}>{scores.participants[0]}</p>
          <div className="flex items-center justify-center gap-3" aria-label={`Score ${homeGoals ?? "unavailable"} to ${awayGoals ?? "unavailable"}`}>
            <span className="text-3xl font-bold tabular-nums text-zinc-50 sm:text-4xl">{homeGoals ?? "—"}</span>
            <span className="text-lg text-zinc-600">–</span>
            <span className="text-3xl font-bold tabular-nums text-zinc-50 sm:text-4xl">{awayGoals ?? "—"}</span>
          </div>
          <p className="truncate text-left text-sm font-semibold text-zinc-200 sm:text-base" title={scores.participants[1]}>{scores.participants[1]}</p>
        </div>
        <div className="mt-2 flex items-center justify-center gap-3 text-xs text-zinc-400 sm:text-sm">
          <span>{PHASE_LABEL[scores.matchPhase]}</span>
          {(scores.matchPhase === "FIRST_HALF" || scores.matchPhase === "SECOND_HALF") && <><span className="text-zinc-700">|</span><span className="font-mono tabular-nums text-zinc-200">{scores.matchMinute}&apos;</span></>}
        </div>
      </div>
    </header>
  );
}
