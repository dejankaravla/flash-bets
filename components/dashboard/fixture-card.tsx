"use client";

import Link from "next/link";
import { useMatchWindowCountdown } from "@/lib/hooks/use-match-window-countdown";
import { formatMatchDateTime } from "@/lib/match-window";
import type { DashboardFixture } from "@/lib/types/dashboard";

interface FixtureCardProps {
  fixture: DashboardFixture;
}

function LiveStatusBadge({ fixture }: { fixture: DashboardFixture }) {
  if (fixture.isInPlay) {
    const minuteLabel =
      fixture.matchMinute !== undefined ? ` · ${fixture.matchMinute}'` : "";

    return (
      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Live{minuteLabel}
      </span>
    );
  }

  if (fixture.segment === "live") {
    return (
      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
        In window
      </span>
    );
  }

  return null;
}

export function FixtureCard({ fixture }: FixtureCardProps) {
  const isLiveSegment = fixture.segment === "live";
  const isInPlay = fixture.isInPlay === true;
  const isFinished = fixture.segment === "finished";
  const isClickable = isLiveSegment;
  const finishedHomeScore = fixture.homeScore ?? 0;
  const finishedAwayScore = fixture.awayScore ?? 0;
  const showFinishedScore = isFinished || (isLiveSegment && fixture.homeScore !== undefined);
  const { label: countdownLabel, isUrgent } = useMatchWindowCountdown(
    isLiveSegment ? fixture.startTimeMs : undefined,
  );

  const content = (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        isInPlay
          ? "border-emerald-500/40 bg-gradient-to-br from-zinc-900 to-emerald-950/20 hover:border-emerald-500/60"
          : isLiveSegment
            ? "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
            : "border-zinc-800 bg-zinc-900"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {fixture.group ? (
          <span className="text-xs font-medium text-zinc-500">{fixture.group}</span>
        ) : (
          <span />
        )}
        <div className="flex flex-col items-end gap-1">
          {isFinished ? (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
              FT
            </span>
          ) : (
            <>
              <LiveStatusBadge fixture={fixture} />
              {isLiveSegment && countdownLabel && (
                <span
                  className={`text-xs tabular-nums ${
                    isUrgent ? "font-medium text-amber-400" : "text-zinc-500"
                  }`}
                >
                  {countdownLabel}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-zinc-100">{fixture.home}</p>
        </div>
        <div className="shrink-0 text-center">
          {showFinishedScore ? (
            <p className="text-2xl font-bold tabular-nums text-zinc-50">
              {isFinished ? finishedHomeScore : fixture.homeScore}
              <span className="mx-2 text-zinc-600">–</span>
              {isFinished ? finishedAwayScore : fixture.awayScore}
            </p>
          ) : (
            <p className="text-sm font-medium text-zinc-600">vs</p>
          )}
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate font-semibold text-zinc-100">{fixture.away}</p>
        </div>
      </div>

      {isFinished && fixture.startTimeMs && (
        <p className="mt-3 text-center text-xs text-zinc-500">
          Started {formatMatchDateTime(fixture.startTimeMs)}
          {fixture.endedTimeMs && (
            <>
              <span className="mx-1.5 text-zinc-600">·</span>
              Ended {formatMatchDateTime(fixture.endedTimeMs)}
            </>
          )}
        </p>
      )}

      {fixture.segment === "upcoming" && fixture.kickoffLabel && (
        <p className="mt-3 text-center text-xs text-zinc-500">
          {fixture.kickoffLabel}
        </p>
      )}

      {isLiveSegment && (
        <p className="mt-3 text-center text-xs text-emerald-400">
          Tap to enter live arena
        </p>
      )}
    </div>
  );

  if (isClickable) {
    return (
      <Link href={`/match/${fixture.id}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
