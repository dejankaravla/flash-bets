import {
  computePoolSplit,
  computePoolTotalUsdc,
  formatCountdown,
  formatWindowLabel,
  getCardState,
  getCardStateLabel,
  getLockoutCountdownSeconds,
  type MicroMarket,
  type MicroMarketCardState,
} from "@/lib/micro-markets";

interface MicroMarketCardProps {
  market: MicroMarket;
  estimatedMatchSeconds: number;
  scoresSeq: number;
  forceClosed?: boolean;
  onSelect: (market: MicroMarket) => void;
}

const stateStyles: Record<MicroMarketCardState, string> = {
  open: "border-zinc-700 bg-zinc-900 hover:border-emerald-500/50 cursor-pointer active:scale-[0.99]",
  locked: "border-zinc-800 bg-zinc-900/60 opacity-70 cursor-not-allowed",
  in_progress: "border-amber-500/30 bg-zinc-900/60 opacity-80 cursor-not-allowed",
  closed: "border-zinc-800/50 bg-zinc-900/40 opacity-50 cursor-not-allowed",
};

export function MicroMarketCard({
  market,
  estimatedMatchSeconds,
  scoresSeq,
  forceClosed = false,
  onSelect,
}: MicroMarketCardProps) {
  const state = getCardState(market, estimatedMatchSeconds, forceClosed);
  const stateLabel = getCardStateLabel(state);
  const countdown = getLockoutCountdownSeconds(market, estimatedMatchSeconds);
  const { yesPct, noPct } = computePoolSplit(scoresSeq);
  const poolTotal = computePoolTotalUsdc(scoresSeq);

  const handleClick = () => {
    if (state === "open") onSelect(market);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state !== "open"}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${stateStyles[state]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {formatWindowLabel(market.windowStart, market.windowEnd)}
          </p>
          <p className="mt-1 text-base font-semibold text-zinc-100">
            {market.proposition}
          </p>
        </div>
        {state === "open" && (
          <span className="shrink-0 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-400">
            Locks in {formatCountdown(countdown)}
          </span>
        )}
        {stateLabel && (
          <span
            className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide ${
              state === "locked"
                ? "bg-red-500/15 text-red-400"
                : state === "in_progress"
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {stateLabel}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-zinc-500">
          <span>YES {yesPct.toFixed(0)}%</span>
          <span>${poolTotal.toLocaleString()} USDC</span>
          <span>NO {noPct.toFixed(0)}%</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="bg-emerald-500 transition-[width] duration-700 ease-out"
            style={{ width: `${yesPct}%` }}
          />
          <div
            className="bg-red-500 transition-[width] duration-700 ease-out"
            style={{ width: `${noPct}%` }}
          />
        </div>
      </div>
    </button>
  );
}
