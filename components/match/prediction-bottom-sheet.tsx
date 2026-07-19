"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import type { Market, PredictionSelection } from "@/lib/domain/flash-bets";
import { readApiError } from "@/lib/client-errors";
import { useWalletAuth } from "@/lib/hooks/use-wallet-auth";
import { formatWindowLabel } from "@/lib/micro-markets";

export function PredictionBottomSheet({ market, onClose }: { market: Market; onClose: () => void }) {
  const { connected } = useWallet();
  const { authenticated, user, loading: authLoading, signIn, refresh } = useWalletAuth();
  const [selection, setSelection] = useState<PredictionSelection>("YES");
  const [amount, setAmount] = useState("50");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const available = user?.flashPoints.available ?? 0;

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submittingRef.current) {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  }, [onClose]);

  const submit = async () => {
    if (submitting) return;
    const flashPoints = Number(amount);
    if (!Number.isSafeInteger(flashPoints) || flashPoints <= 0) {
      setError("Enter a positive whole number of FlashPoints.");
      return;
    }
    if (flashPoints > available) {
      setError(`You have ${available} available FlashPoints. Lower the stake and try again.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.marketId, side: selection, amount: flashPoints }),
      });
      if (!response.ok) {
        const message = await readApiError(response, "Your prediction could not be placed. Try again.");
        if (response.status === 401) await refresh();
        throw new Error(message);
      }
      await refresh();
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your prediction could not be placed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const quickStakes = [25, 50, 100, available].filter((value, index, values) => value > 0 && values.indexOf(value) === index);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:px-4">
      <button type="button" aria-label="Close prediction dialog" className="absolute inset-0 bg-black/75 backdrop-blur-sm" disabled={submitting} onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="prediction-title" aria-describedby="prediction-description" className="relative max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] w-full max-w-lg overscroll-contain overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 px-5 pb-8 pt-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:p-7" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Prediction</p>
            <h2 id="prediction-title" className="mt-1 text-xl font-semibold text-zinc-50">Choose your outcome</h2>
          </div>
          <button ref={closeButtonRef} type="button" disabled={submitting} onClick={onClose} aria-label="Close prediction dialog" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-800 text-xl text-zinc-300 hover:bg-zinc-700 disabled:opacity-40">×</button>
        </div>

        <div id="prediction-description" className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-bold uppercase tracking-wider text-zinc-400">{formatWindowLabel(market.startMinute, market.endMinute)}</span>
            <span className="rounded-md bg-zinc-800 px-2 py-1 font-bold text-zinc-300">{market.type}</span>
          </div>
          <p className="mt-3 font-semibold leading-6 text-zinc-100">{market.question}</p>
        </div>

        {saved ? (
          <div className="mt-6 text-center" aria-live="polite">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-2xl text-emerald-300" aria-hidden>✓</span>
            <h3 className="mt-4 text-xl font-semibold text-zinc-50">Prediction accepted</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-300"><strong>{amount} FlashPoints</strong> are locked on <strong>{selection}</strong> until this market settles or is voided.</p>
            <p className="mt-2 text-xs text-zinc-500">Settlement is automatic. You can safely close this screen.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/my-predictions" className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-4 font-bold text-zinc-950 hover:bg-emerald-400">View My Predictions</Link>
              <button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-zinc-700 px-4 font-semibold text-zinc-200 hover:bg-zinc-800">Back to markets</button>
            </div>
          </div>
        ) : (
          <>
            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-zinc-300">Will it happen?</legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(["YES", "NO"] as const).map((value) => (
                  <button key={value} type="button" aria-pressed={selection === value} onClick={() => setSelection(value)} className={`min-h-14 rounded-xl text-base font-bold transition-colors ${selection === value ? value === "YES" ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-950/30" : "bg-red-500 text-white shadow-lg shadow-red-950/30" : "border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"}`}>{value}</button>
                ))}
              </div>
            </fieldset>

            <div className="mt-6">
              <label htmlFor="prediction-stake" className="flex justify-between gap-3 text-sm font-medium text-zinc-300"><span className="shrink-0">Stake</span><span className="min-w-0 break-words text-right text-zinc-400">{user ? <><strong className="text-emerald-300">{available}</strong> available</> : "Sign in to view balance"}</span></label>
              <div className="relative mt-2">
                <input id="prediction-stake" type="number" min={1} max={available || undefined} step={1} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!authenticated || submitting} aria-describedby="stake-help" className="min-h-14 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 pr-14 text-lg font-mono text-zinc-50 outline-none focus:border-emerald-500 disabled:opacity-50" />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">FP</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Quick stake amounts">
                {quickStakes.map((value) => <button key={value} type="button" disabled={!authenticated || submitting} onClick={() => setAmount(String(value))} className="min-h-11 min-w-11 rounded-lg bg-zinc-800 px-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 disabled:opacity-40">{value === available ? `Max ${value}` : value}</button>)}
              </div>
              <p id="stake-help" className="mt-3 text-xs leading-5 text-zinc-500">FlashPoints are whole-number demo points. They cannot be purchased, transferred, withdrawn, or redeemed.</p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-center text-xs">
              <div className="min-w-0"><span className="block text-zinc-500">Selection</span><strong className={selection === "YES" ? "mt-1 block break-words text-emerald-300" : "mt-1 block break-words text-red-300"}>{selection}</strong></div>
              <div className="min-w-0"><span className="block text-zinc-500">Stake</span><strong className="mt-1 block break-words text-zinc-200">{amount || 0} FP</strong></div>
              <div className="min-w-0"><span className="block text-zinc-500">After lock</span><strong className="mt-1 block break-words text-zinc-200">{Math.max(0, available - (Number(amount) || 0))} FP</strong></div>
            </div>

            {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-3 text-sm text-red-200">{error}</p>}

            {!connected ? (
              <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-zinc-950/50 p-4"><p className="text-sm text-zinc-300">Connect a wallet to use your FlashPoints.</p><WalletMultiButton /></div>
            ) : !authenticated ? (
              <button type="button" disabled={authLoading} onClick={() => void signIn()} className="mt-6 min-h-14 w-full rounded-xl bg-emerald-500 font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">{authLoading ? "Waiting for signature…" : "Sign in to predict"}</button>
            ) : (
              <button type="button" disabled={submitting || !amount} onClick={() => void submit()} className="mt-6 min-h-14 w-full rounded-xl bg-emerald-500 font-bold text-zinc-950 shadow-lg shadow-emerald-950/30 hover:bg-emerald-400 disabled:opacity-50">{submitting ? "Locking FlashPoints…" : `Confirm ${selection} · Lock ${amount || "0"} FP`}</button>
            )}
            {submitting && <p role="status" className="mt-3 text-center text-xs text-zinc-400">Saving your prediction and updating your balance…</p>}
          </>
        )}
      </div>
    </div>
  );
}
