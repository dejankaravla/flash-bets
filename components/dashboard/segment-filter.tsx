"use client";

import type { FlashBetsMode } from "@/lib/app-mode";
import type { DashboardSegment } from "@/lib/types/dashboard";

interface SegmentFilterProps {
  active: DashboardSegment;
  onChange: (segment: DashboardSegment) => void;
  mode: FlashBetsMode;
}

export function SegmentFilter({ active, onChange, mode }: SegmentFilterProps) {
  const segments: { id: DashboardSegment; label: string }[] = mode === "REPLAY"
    ? [{ id: "replay", label: "REPLAY" }, { id: "finished", label: "FINISHED" }, { id: "unavailable", label: "UNAVAILABLE" }]
    : [{ id: "live", label: "LIVE" }, { id: "upcoming", label: "UPCOMING" }, { id: "finished", label: "FINISHED" }, { id: "unavailable", label: "UNAVAILABLE" }];
  return (
    <div className={`grid gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-1.5 ${segments.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`} aria-label="Match categories">
      {segments.map((segment) => {
        const selected = active === segment.id;
        return (
          <button
            key={segment.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(segment.id)}
            className={`min-h-11 rounded-xl px-2 py-2 text-xs font-bold tracking-wide transition-colors ${selected ? (mode === "REPLAY" ? "bg-violet-500 text-white shadow-lg shadow-violet-950/30" : "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-950/30") : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}`}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
