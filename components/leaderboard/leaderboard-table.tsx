import type { LeaderboardEntry } from "@/lib/mock-leaderboard";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

const RANK_STYLES: Record<number, string> = {
  1: "border-amber-500/40 bg-amber-500/5",
  2: "border-zinc-400/30 bg-zinc-400/5",
  3: "border-orange-700/40 bg-orange-700/5",
};

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <span>Rank</span>
        <span>User</span>
        <span className="text-right">ROI</span>
        <span className="text-right">Streak</span>
      </div>
      <ul>
        {entries.map((entry) => (
          <li
            key={entry.rank}
            className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 border-b border-zinc-800/50 px-4 py-3 last:border-b-0 ${
              RANK_STYLES[entry.rank] ?? ""
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-300">
              {entry.rank}
            </span>
            <span className="truncate font-mono text-sm text-zinc-200">
              {entry.walletHandle}
            </span>
            <span
              className={`text-right text-sm font-semibold tabular-nums ${
                entry.roiPercent >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {entry.roiPercent >= 0 ? "+" : ""}
              {entry.roiPercent.toFixed(1)}%
            </span>
            <span className="text-right text-sm text-zinc-400">
              {entry.hotstreak > 0 ? `🔥 ${entry.hotstreak}` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
