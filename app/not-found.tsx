import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center px-5 py-12 text-center">
      <section className="w-full rounded-3xl border border-zinc-800 bg-zinc-900 px-6 py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">404 · Offside</p>
        <h1 className="mt-3 text-3xl font-bold text-zinc-50">That page is not on the pitch</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">The link may be old, or the replay run may have been replaced. Choose an available match to continue.</p>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-500 px-5 text-sm font-bold text-zinc-950 hover:bg-emerald-400">Browse matches</Link>
      </section>
    </main>
  );
}
