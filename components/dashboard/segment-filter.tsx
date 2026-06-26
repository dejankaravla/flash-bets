"use client";

import type { DashboardSegment } from "@/lib/types/dashboard";

const SEGMENTS: { id: DashboardSegment; label: string }[] = [
  { id: "live", label: "LIVE" },
  { id: "upcoming", label: "UPCOMING" },
  { id: "finished", label: "FINISHED" },
];

interface SegmentFilterProps {
  active: DashboardSegment;
  onChange: (segment: DashboardSegment) => void;
}

export function SegmentFilter({ active, onChange }: SegmentFilterProps) {
  return (
    <div className="flex gap-2 rounded-xl bg-zinc-900 p-1">
      {SEGMENTS.map((seg) => (
        <button
          key={seg.id}
          type="button"
          onClick={() => onChange(seg.id)}
          className={`flex-1 rounded-lg py-2 text-xs font-bold tracking-wide transition-colors ${
            active === seg.id
              ? "bg-emerald-500 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {seg.label}
        </button>
      ))}
    </div>
  );
}
