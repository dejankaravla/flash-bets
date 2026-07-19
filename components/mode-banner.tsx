import type { FlashBetsMode } from "@/lib/app-mode";

export function ModeBanner({ mode }: { mode: FlashBetsMode }) {
  return (
    <div
      className={`border-b px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] ${
        mode === "REPLAY"
          ? "border-violet-400/30 bg-violet-500/15 text-violet-200"
          : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
      }`}
    >
      <span className="sm:hidden">{mode === "REPLAY" ? "Replay demo · historical data" : "Live mode · demo FlashPoints"}</span>
      <span className="hidden sm:inline">
        {mode === "REPLAY"
          ? "Replay demo · historical TxLINE data · FlashPoints have no monetary value"
          : "Live Mode · TxLINE data · FlashPoints have no monetary value"}
      </span>
    </div>
  );
}
