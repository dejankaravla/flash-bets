"use client";

import Link from "next/link";

export default function AppError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center px-5 py-12 text-center">
      <section className="w-full rounded-3xl border border-red-500/25 bg-red-500/10 px-6 py-10">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15 text-xl font-bold text-red-200" aria-hidden>!</span>
        <h1 className="mt-4 text-2xl font-semibold text-zinc-50">FlashBets hit a temporary problem</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-300">Your wallet and FlashPoints have not been changed. Try this screen again, or return to Matches and continue from there.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => unstable_retry()} className="min-h-11 rounded-xl bg-red-200 px-5 text-sm font-bold text-zinc-950 hover:bg-red-100">Try again</button>
          <Link href="/dashboard" className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 px-5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800">Return to Matches</Link>
        </div>
      </section>
    </main>
  );
}
