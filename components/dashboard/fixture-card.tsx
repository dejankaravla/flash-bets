"use client";

import Link from "next/link";

import { formatMatchDateTime } from "@/lib/match-window";
import type { DashboardFixture } from "@/lib/types/dashboard";

function StatusBadge({ fixture }: { fixture: DashboardFixture }) {
  if (fixture.sourceMode === "REPLAY") {
    const label = fixture.replayStatus === "PLAYING"
      ? "Replaying"
      : fixture.replayStatus === "PAUSED"
        ? "Paused"
        : fixture.replayStatus === "FINISHED"
          ? "Finished"
          : "Replay";
    return <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-200">{label}</span>;
  }
  if (fixture.segment === "live" && fixture.isInPlay) {
    return <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />Live{fixture.matchMinute !== undefined ? ` · ${fixture.matchMinute}'` : ""}</span>;
  }
  if (fixture.segment === "finished") return <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold uppercase text-zinc-300">Full time</span>;
  if (fixture.segment === "upcoming") return <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase text-sky-200">Upcoming</span>;
  return <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase text-amber-200">Unavailable</span>;
}

export function FixtureCard({
  fixture,
  selecting = false,
  onReplaySelect,
}: {
  fixture: DashboardFixture;
  selecting?: boolean;
  onReplaySelect?: (replayId: string) => void | Promise<void>;
}) {
  const liveClickable = fixture.segment === "live" && fixture.isInPlay === true;
  const replayClickable = fixture.sourceMode === "REPLAY" && Boolean(fixture.replayId && onReplaySelect);
  const actionLabel = replayClickable
    ? selecting
      ? "Preparing replay…"
      : fixture.replayStatus === "FINISHED"
        ? "Start a new replay run"
        : "Choose this replay"
    : liveClickable
      ? "Open live match"
      : null;

  const content = (
    <article className={`h-full rounded-3xl border p-5 text-left transition-all ${liveClickable || replayClickable ? replayClickable ? "border-violet-500/35 bg-gradient-to-br from-zinc-900 to-violet-950/25 hover:-translate-y-0.5 hover:border-violet-400/70 hover:shadow-xl hover:shadow-violet-950/20" : "border-emerald-500/35 bg-gradient-to-br from-zinc-900 to-emerald-950/20 hover:-translate-y-0.5 hover:border-emerald-400/60 hover:shadow-xl hover:shadow-emerald-950/20" : "border-zinc-800 bg-zinc-900/70"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-xs font-medium text-zinc-400">{fixture.group ?? "Football"}</span>
        <StatusBadge fixture={fixture} />
      </div>
      {fixture.replayTitle && <h2 className="mt-4 text-base font-semibold text-violet-100">{fixture.replayTitle}</h2>}
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <p className="min-w-0 truncate font-semibold text-zinc-100" title={fixture.home}>{fixture.home}</p>
        <div className="shrink-0 text-center">
          {fixture.homeScore !== undefined && fixture.awayScore !== undefined
            ? <p className="text-2xl font-bold tabular-nums text-zinc-50">{fixture.homeScore}<span className="mx-2 text-zinc-600">–</span>{fixture.awayScore}</p>
            : <p className="text-sm font-medium text-zinc-500">vs</p>}
        </div>
        <p className="min-w-0 truncate text-right font-semibold text-zinc-100" title={fixture.away}>{fixture.away}</p>
      </div>
      {fixture.kickoffLabel && <p className="mt-4 text-center text-xs text-zinc-400">Kickoff {fixture.kickoffLabel}</p>}
      {fixture.segment === "finished" && fixture.endedTimeMs && <p className="mt-4 text-center text-xs text-zinc-400">Last update {formatMatchDateTime(fixture.endedTimeMs)}</p>}
      {fixture.sourceMode === "REPLAY" && <p className="mt-4 line-clamp-2 text-sm leading-5 text-zinc-400">{fixture.availabilityReason}</p>}
      {actionLabel && <p className={`mt-5 flex min-h-10 items-center justify-center rounded-xl text-xs font-bold ${replayClickable ? "bg-violet-500/15 text-violet-200" : "bg-emerald-500/15 text-emerald-300"}`}>{actionLabel}<span className="ml-1" aria-hidden>→</span></p>}
      {fixture.segment === "unavailable" && <p className="mt-4 rounded-xl bg-zinc-800/70 px-3 py-2 text-center text-xs leading-5 text-zinc-400">{fixture.availabilityReason ?? "No trustworthy match state is available yet."}</p>}
    </article>
  );

  const accessibleLabel = `${fixture.home} versus ${fixture.away}${fixture.replayTitle ? `, ${fixture.replayTitle}` : ""}`;
  if (liveClickable) return <Link href={`/match/${fixture.id}`} aria-label={`Open ${accessibleLabel}`} className="block h-full rounded-3xl">{content}</Link>;
  if (replayClickable) return <button type="button" disabled={selecting} aria-busy={selecting} aria-label={actionLabel ?? accessibleLabel} onClick={() => fixture.replayId && void onReplaySelect?.(fixture.replayId)} className="block h-full w-full rounded-3xl disabled:opacity-60">{content}</button>;
  return content;
}
