"use client";

type BetTab = "active" | "settled";

interface BetTabsProps {
  active: BetTab;
  onChange: (tab: BetTab) => void;
}

export function BetTabs({ active, onChange }: BetTabsProps) {
  return (
    <div className="flex gap-2 rounded-xl bg-zinc-900 p-1">
      <button
        type="button"
        onClick={() => onChange("active")}
        className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
          active === "active"
            ? "bg-zinc-800 text-zinc-50"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        Active
      </button>
      <button
        type="button"
        onClick={() => onChange("settled")}
        className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
          active === "settled"
            ? "bg-zinc-800 text-zinc-50"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        Settled
      </button>
    </div>
  );
}
