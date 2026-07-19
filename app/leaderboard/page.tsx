import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Leaderboard unavailable · FlashBets",
};

export default function LeaderboardPage() {
  return (
    <div className="mx-auto flex min-h-[65vh] w-full max-w-2xl items-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-3xl border border-zinc-800 bg-zinc-900/70 px-6 py-10 text-center shadow-xl shadow-black/10 sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Outside the demo scope</p>
        <h1 className="mt-3 text-3xl font-semibold text-zinc-50">No leaderboard is available</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-400">
          FlashBets focuses on the complete five-minute prediction and settlement journey. No rankings or fabricated player scores are shown.
        </p>
        <Link href="/dashboard" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 font-bold text-zinc-950 hover:bg-emerald-400">
          Browse matches
        </Link>
      </section>
    </div>
  );
}
