import { formatWindowLabel } from "@/lib/micro-markets";
import type { Market, MarketStatus } from "@/lib/domain/flash-bets";

const stateStyles: Record<MarketStatus, string> = {
  CREATED: "border-zinc-800 bg-zinc-900/60",
  OPEN: "border-emerald-500/35 bg-gradient-to-br from-zinc-900 to-emerald-950/15 hover:-translate-y-0.5 hover:border-emerald-400/70 hover:shadow-xl hover:shadow-emerald-950/20 active:translate-y-0",
  LOCKED: "border-zinc-800 bg-zinc-900/70",
  WAITING_FOR_SETTLEMENT: "border-amber-500/30 bg-amber-950/10",
  SETTLED: "border-emerald-500/25 bg-emerald-950/10",
  VOID: "border-zinc-700 bg-zinc-900/60",
};

const stateLabels: Record<MarketStatus, string> = {
  CREATED: "Upcoming",
  OPEN: "Open now",
  LOCKED: "Prediction locked",
  WAITING_FOR_SETTLEMENT: "Settlement pending",
  SETTLED: "Settled",
  VOID: "Voided",
};

const stateHelp: Record<MarketStatus, string> = {
  CREATED: "This window will open when its lead period begins.",
  OPEN: "Choose Yes or No and lock your FlashPoints.",
  LOCKED: "No more predictions can be placed for this window.",
  WAITING_FOR_SETTLEMENT: "The correction delay is running. Settlement is automatic.",
  SETTLED: "Open My Predictions to review your receipt.",
  VOID: "Locked FlashPoints are refunded automatically.",
};

export function MicroMarketCard({ market, onSelect }: { market: Market; onSelect: (market: Market) => void }) {
  const open = market.status === "OPEN";
  const statusTone = open
    ? "bg-emerald-500/15 text-emerald-300"
    : market.status === "WAITING_FOR_SETTLEMENT"
      ? "bg-amber-500/15 text-amber-200"
      : market.status === "SETTLED"
        ? "bg-emerald-500/10 text-emerald-200"
        : "bg-zinc-800 text-zinc-300";

  return (
    <button
      type="button"
      onClick={() => open && onSelect(market)}
      disabled={!open}
      aria-label={`${market.question}, ${formatWindowLabel(market.startMinute, market.endMinute)}, ${stateLabels[market.status]}`}
      className={`min-h-40 w-full rounded-3xl border p-5 text-left transition-all disabled:cursor-default ${stateStyles[market.status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{formatWindowLabel(market.startMinute, market.endMinute)}</p>
          <p className="mt-2 text-base font-semibold leading-6 text-zinc-50">{market.question}</p>
        </div>
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusTone}`}>{stateLabels[market.status]}</span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4 border-t border-zinc-800/80 pt-4">
        <div>
          <p className="text-xs font-bold text-zinc-300">YES <span className="mx-1 text-zinc-600">or</span> NO</p>
          <p className="mt-1 text-xs text-zinc-500">{market.type === "GOAL" ? "Goal event" : "Corner event"} · FlashPoints</p>
        </div>
        <p className={`max-w-48 text-right text-xs leading-5 ${open ? "font-semibold text-emerald-300" : "text-zinc-400"}`}>{stateHelp[market.status]}</p>
      </div>
    </button>
  );
}
