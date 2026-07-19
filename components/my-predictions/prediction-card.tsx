import type { PredictionStatus, PredictionView } from "@/lib/domain/flash-bets";
import { formatWindowLabel } from "@/lib/micro-markets";

const statusStyles: Record<PredictionStatus, string> = {
  PENDING: "bg-sky-500/15 text-sky-200",
  LOCKED: "bg-amber-500/15 text-amber-200",
  WON: "bg-emerald-500/15 text-emerald-200",
  LOST: "bg-red-500/15 text-red-200",
  REFUNDED: "bg-violet-500/15 text-violet-200",
  VOID: "bg-zinc-700 text-zinc-100",
};

const statusLabel: Record<PredictionStatus, string> = {
  PENDING: "Accepted",
  LOCKED: "Locked",
  WON: "Won",
  LOST: "Lost",
  REFUNDED: "Refunded",
  VOID: "Void · refunded",
};

function readableReason(reason: string): string {
  return reason.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function PredictionCard({ prediction }: { prediction: PredictionView }) {
  const market = prediction.market;
  const fixture = prediction.fixture;
  const receipt = prediction.receipt;
  const mode = market?.sourceMode ?? "LIVE";
  const fixtureLabel = fixture
    ? `${fixture.participants[0]} vs ${fixture.participants[1]}`
    : market
      ? `Fixture ${market.fixtureId}`
      : "Fixture unavailable";

  return (
    <article className="min-w-0 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-lg shadow-black/10">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${mode === "REPLAY" ? "bg-violet-500/15 text-violet-200" : "bg-emerald-500/15 text-emerald-200"}`}>{mode}</span>
              <span className="text-xs text-zinc-500">{new Date(prediction.createdAt).toLocaleString()}</span>
            </div>
            <h2 className="mt-3 truncate text-sm font-semibold text-zinc-200 sm:text-base" title={fixtureLabel}>{fixtureLabel}</h2>
            <p className="mt-1 break-words font-semibold leading-6 text-zinc-50">{market?.question ?? prediction.marketId}</p>
            {market && <p className="mt-1 text-sm text-zinc-400">{formatWindowLabel(market.startMinute, market.endMinute)} · {market.period === "FIRST_HALF" ? "First half" : "Second half"}</p>}
          </div>
          <span className={`shrink-0 self-start rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide ${statusStyles[prediction.status]}`}>{statusLabel[prediction.status]}</span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-zinc-800 text-center">
          <div className="min-w-0 bg-zinc-950/55 p-2.5 sm:p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Selection</p><p className={`mt-1 break-words text-sm font-bold sm:text-base ${prediction.side === "YES" ? "text-emerald-300" : "text-red-300"}`}>{prediction.side}</p></div>
          <div className="min-w-0 bg-zinc-950/55 p-2.5 sm:p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Stake</p><p className="mt-1 break-words text-sm font-bold text-zinc-100 sm:text-base">{prediction.amount} FP</p></div>
          <div className="min-w-0 bg-zinc-950/55 p-2.5 sm:p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Returned</p><p className={`mt-1 break-words text-sm font-bold sm:text-base ${prediction.reward > 0 ? "text-emerald-300" : prediction.refund > 0 ? "text-violet-200" : "text-zinc-400"}`}>{prediction.reward + prediction.refund} FP</p></div>
        </div>

        {!receipt && (
          <div role="status" className="mt-4 flex gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <span className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-300" aria-hidden />
            <div><p className="text-sm font-semibold text-amber-100">{prediction.status === "PENDING" ? "Prediction accepted" : "Settlement pending"}</p><p className="mt-1 text-xs leading-5 text-amber-100/70">{prediction.status === "PENDING" ? "The stake will lock when betting closes for this window." : "The server worker settles automatically after the window and correction delay. No action is required."}</p></div>
          </div>
        )}
      </div>

      {receipt && (
        <details className="group border-t border-zinc-800 bg-zinc-950/40">
          <summary className="relative flex min-h-14 list-none flex-col items-start justify-center gap-1 px-5 py-4 pr-12 text-sm font-semibold text-zinc-100 hover:bg-zinc-800/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:pr-12">
            <span className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300" aria-hidden>✓</span><span className="break-words">View settlement receipt</span></span>
            <span className="break-words text-xs font-normal text-zinc-500 group-open:hidden">Outcome {receipt.winningSide ?? "VOID"} · {new Date(receipt.createdAt).toLocaleDateString()}</span>
            <span className="absolute right-5 top-1/2 hidden -translate-y-1/2 text-zinc-400 group-open:inline" aria-hidden>−</span>
          </summary>
          <section className="border-t border-zinc-800 px-5 py-5 sm:px-6" aria-label="Settlement receipt details">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">FlashBets receipt</p>
                <h3 className="mt-2 break-words text-lg font-semibold text-zinc-50">{fixtureLabel}</h3>
                <p className="mt-1 break-words text-sm text-zinc-400">{market?.type ?? "Market"} · {market ? formatWindowLabel(market.startMinute, market.endMinute) : receipt.marketId}</p>
              </div>
              <span className={`self-start rounded-xl px-3 py-2 text-sm font-bold ${receipt.winningSide === "YES" ? "bg-emerald-500/15 text-emerald-200" : receipt.winningSide === "NO" ? "bg-red-500/15 text-red-200" : "bg-zinc-800 text-zinc-200"}`}>{receipt.winningSide ? `${receipt.winningSide} won` : "Market void"}</span>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-900 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{market?.type === "CORNER" ? "Corner delta" : "Goal delta"}</dt><dd className="mt-1 text-lg font-bold text-zinc-100">{receipt.calculatedDelta ?? "Unavailable"}</dd></div>
              <div className="min-w-0 rounded-xl bg-zinc-900 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Your result</dt><dd className="mt-1 break-words text-base font-bold text-zinc-100 sm:text-lg">{statusLabel[prediction.status]} · {prediction.reward > 0 ? `${prediction.reward} FP award` : prediction.refund > 0 ? `${prediction.refund} FP refund` : "0 FP returned"}</dd></div>
              <div className="min-w-0 rounded-xl bg-zinc-900 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Pool</dt><dd className="mt-1 break-words text-sm font-semibold text-zinc-200">{receipt.totalPool} FP total · {receipt.winningPool} FP winning</dd></div>
              <div className="min-w-0 rounded-xl bg-zinc-900 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Settlement</dt><dd className="mt-1 break-words text-sm font-semibold text-zinc-200">{new Date(receipt.createdAt).toLocaleString()}</dd></div>
            </dl>

            <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-2xl border border-zinc-800 p-4 text-xs">
              <dt className="text-zinc-500">Reason</dt><dd className="min-w-0 break-words text-right text-zinc-300">{readableReason(receipt.settlementReason)}</dd>
              <dt className="text-zinc-500">Correction delay</dt><dd className="min-w-0 break-words text-right text-zinc-300">{receipt.correctionDelaySeconds} seconds</dd>
              <dt className="text-zinc-500">Opening data</dt><dd className="min-w-0 break-words text-right text-zinc-300">{receipt.txLineOpeningTimestamp ? new Date(receipt.txLineOpeningTimestamp).toLocaleString() : "Unavailable"}</dd>
              <dt className="text-zinc-500">Closing data</dt><dd className="min-w-0 break-words text-right text-zinc-300">{receipt.txLineClosingTimestamp ? new Date(receipt.txLineClosingTimestamp).toLocaleString() : "Unavailable"}</dd>
              <dt className="text-zinc-500">Version</dt><dd className="min-w-0 break-words text-right font-mono text-zinc-300">{receipt.settlementVersion}</dd>
            </dl>

            <div className="mt-4 rounded-xl bg-zinc-900 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Receipt ID</p>
              <code className="mt-1 block break-all text-xs leading-5 text-emerald-200">{receipt.receiptId}</code>
            </div>
          </section>
        </details>
      )}
    </article>
  );
}
