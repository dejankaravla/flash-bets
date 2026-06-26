"use client";

import { useState } from "react";
import { FixtureCard } from "@/components/dashboard/fixture-card";
import { SegmentFilter } from "@/components/dashboard/segment-filter";
import { WalletAddressBadge } from "@/components/wallet-address-badge";
import {
  getFixturesBySegment,
  type DashboardFixture,
  type DashboardSegment,
} from "@/lib/types/dashboard";

interface DashboardContentProps {
  fixtures: DashboardFixture[];
}

export function DashboardContent({ fixtures }: DashboardContentProps) {
  const [segment, setSegment] = useState<DashboardSegment>("live");
  const filtered = getFixturesBySegment(fixtures, segment);

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-zinc-950 px-4 py-6">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">
              World Cup 2026
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Tournament</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Live matches and upcoming fixtures
            </p>
          </div>
          <WalletAddressBadge />
        </div>
      </header>

      <SegmentFilter active={segment} onChange={setSegment} />

      <div className="mt-6 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No matches in this category
          </p>
        ) : (
          filtered.map((fixture) => (
            <FixtureCard key={fixture.id} fixture={fixture} />
          ))
        )}
      </div>
    </div>
  );
}
