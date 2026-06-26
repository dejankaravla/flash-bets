"use client";

import { WalletAddressBadge } from "@/components/wallet-address-badge";
import { formatMatchClock } from "@/lib/micro-markets";
import { GAME_PHASE, STAT_KEY, type TxLineScoresUpdate } from "@/lib/types/txline";

interface LiveMatchHeaderProps {
  scores: TxLineScoresUpdate;
  estimatedMatchSeconds: number;
}

const PHASE_SHORT_LABEL: Record<number, string> = {
  [GAME_PHASE.NS]: "Not Started",
  [GAME_PHASE.H1]: "1st Half",
  [GAME_PHASE.HT]: "Halftime",
  [GAME_PHASE.H2]: "2nd Half",
  [GAME_PHASE.F]: "Full Time",
};

export function LiveMatchHeader({
  scores,
  estimatedMatchSeconds,
}: LiveMatchHeaderProps) {
  const homeGoals = scores.stats[STAT_KEY.P1_GOALS] ?? 0;
  const awayGoals = scores.stats[STAT_KEY.P2_GOALS] ?? 0;
  const isLive = scores.gameState !== GAME_PHASE.F;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-400">
              {scores.participants[0]}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-red-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                Live
              </span>
            )}
            <WalletAddressBadge />
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-sm font-medium text-zinc-400">
              {scores.participants[1]}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center gap-4">
          <span className="text-3xl font-bold tabular-nums text-zinc-50">
            {homeGoals}
          </span>
          <span className="text-lg text-zinc-600">–</span>
          <span className="text-3xl font-bold tabular-nums text-zinc-50">
            {awayGoals}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-center gap-3 text-sm text-zinc-400">
          <span>{PHASE_SHORT_LABEL[scores.gameState] ?? "—"}</span>
          <span className="text-zinc-700">|</span>
          <span className="font-mono tabular-nums text-zinc-300">
            {formatMatchClock(estimatedMatchSeconds)}
          </span>
        </div>
      </div>
    </header>
  );
}
