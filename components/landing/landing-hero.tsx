"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { useWalletAuth } from "@/lib/hooks/use-wallet-auth";
import type { FlashBetsMode } from "@/lib/app-mode";

export function LandingHero({ mode }: { mode: FlashBetsMode }) {
  const { connected } = useWallet();
  const { authenticated, loading, error, signIn } = useWalletAuth();
  const router = useRouter();
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (authenticated) router.push("/dashboard");
  }, [authenticated, router]);

  const steps = [
    ["Connect wallet", "Sign one authentication message—never a transaction."],
    ["Receive FlashPoints", "Your profile starts with 1,000 non-transferable points."],
    ["Predict Goal or Corner", "Choose Yes or No and lock a whole-number stake."],
    [
      "Watch automatic settlement",
      mode === "REPLAY"
        ? "Play the historical match at up to 10× speed."
        : "TxLINE updates decide the completed window.",
    ],
    ["Open your receipt", "Review the source delta, outcome, award, and settlement version."],
  ];

  return (
    <div className="relative flex min-h-[calc(100vh-34px)] flex-col overflow-hidden bg-zinc-950">
      <div
        className={`pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${
          mode === "REPLAY"
            ? "from-violet-900/25 via-zinc-950 to-zinc-950"
            : "from-emerald-900/20 via-zinc-950 to-zinc-950"
        }`}
        aria-hidden
      />

      <main className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
        <section>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${mode === "REPLAY" ? "border-violet-400/30 bg-violet-500/10 text-violet-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"}`}>
            <span className={`h-2 w-2 rounded-full ${mode === "REPLAY" ? "bg-violet-400" : "bg-emerald-400"}`} />
            {mode === "REPLAY" ? "Replay demo mode" : "Live TxLINE mode"}
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-zinc-50 sm:text-6xl">
            Predict the next five minutes of football.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
            Connect a wallet, receive 1,000 demo FlashPoints, and predict whether a Goal or Corner will happen in the next match window. Settlement and receipts are automatic.
          </p>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            {hasMounted ? (
              <WalletMultiButton className="!min-h-12 !whitespace-nowrap !rounded-full !bg-emerald-500 !px-7 !text-sm !font-bold !text-zinc-950 !shadow-lg !shadow-emerald-500/20 hover:!bg-emerald-400" />
            ) : (
              <button type="button" disabled className="min-h-12 rounded-full bg-emerald-500 px-7 text-sm font-bold text-zinc-950 opacity-80">
                Connect wallet
              </button>
            )}
            {connected && !authenticated && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void signIn()}
                className="min-h-12 rounded-full border border-emerald-500/50 px-7 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                {loading ? "Waiting for signature…" : "Sign in with wallet"}
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-4 max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error} Try connecting again.
            </p>
          )}

          <p className="mt-6 max-w-xl text-xs leading-5 text-zinc-500">
            Your wallet is identity only. No transaction is created. FlashPoints cannot be bought, sold, transferred, withdrawn, or redeemed.
          </p>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7" aria-labelledby="how-it-works">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Judge flow</p>
              <h2 id="how-it-works" className="mt-2 text-2xl font-semibold text-zinc-50">From wallet to receipt</h2>
            </div>
            {mode === "REPLAY" && <span className="rounded-lg bg-violet-500/15 px-2.5 py-1 text-xs font-bold text-violet-200">Historical data</span>}
          </div>
          <ol className="mt-7 space-y-1">
            {steps.map(([title, description], index) => (
              <li key={title} className="relative flex gap-4 pb-5 last:pb-0">
                {index < steps.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-1.5rem)] w-px bg-zinc-700" aria-hidden />}
                <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-400/25 bg-emerald-500/10 text-sm font-bold text-emerald-300">{index + 1}</span>
                <span className="pt-0.5">
                  <span className="block font-semibold text-zinc-100">{title}</span>
                  <span className="mt-1 block text-sm leading-5 text-zinc-400">{description}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
