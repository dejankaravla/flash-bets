import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { LEADERBOARD_ENTRIES } from "@/lib/mock-leaderboard";

export default function LeaderboardPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-zinc-950 px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Leaderboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Top predictors this tournament</p>
      </header>

      <LeaderboardTable entries={LEADERBOARD_ENTRIES} />
    </div>
  );
}
