import {
  getTxLineApiUrl,
  hasTxLineCredentials,
  txLineHeaders,
} from "@/lib/txline-auth";
import {
  gameStateFromString,
  isFinishedGameState,
  isInPlayGameState,
  normalizeScoresUpdate,
  type RawTxLineScores,
} from "@/lib/txline-normalize";
import { STAT_KEY } from "@/lib/types/txline";
import type { DashboardFixture, DashboardSegment } from "@/lib/types/dashboard";
import { MATCH_WINDOW_MS, formatMatchDateTime, getMatchWindowEndMs } from "@/lib/match-window";

interface TxLineFixtureRow {
  FixtureId?: number;
  fixtureId?: number;
  Participant1?: string;
  Participant2?: string;
  participant1?: string;
  participant2?: string;
  Participant1IsHome?: boolean;
  participant1IsHome?: boolean;
  StartTime?: number;
  startTime?: number;
  Competition?: string;
  competition?: string;
  FixtureGroupId?: number;
  fixtureGroupId?: number;
}

function toEpochMs(value: number): number {
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function formatKickoffLabel(startMs: number): string {
  return formatMatchDateTime(startMs);
}

function segmentFromKickoff(startMs: number, now: number): DashboardSegment {
  if (startMs > now) return "upcoming";
  if (now - startMs < MATCH_WINDOW_MS) return "live";
  return "finished";
}

function mapFixtureRow(row: TxLineFixtureRow): DashboardFixture | null {
  const id = row.FixtureId ?? row.fixtureId;
  const startRaw = row.StartTime ?? row.startTime;
  if (id === undefined || startRaw === undefined) return null;

  const p1 = row.Participant1 ?? row.participant1 ?? "TBD";
  const p2 = row.Participant2 ?? row.participant2 ?? "TBD";
  const p1Home = row.Participant1IsHome ?? row.participant1IsHome ?? true;
  const startMs = toEpochMs(startRaw);
  const now = Date.now();
  const segment = segmentFromKickoff(startMs, now);

  return {
    id,
    home: p1Home ? p1 : p2,
    away: p1Home ? p2 : p1,
    segment,
    startTimeMs: startMs,
    endedTimeMs: segment === "finished" ? getMatchWindowEndMs(startMs) : undefined,
    kickoffLabel: segment === "upcoming" ? formatKickoffLabel(startMs) : undefined,
    group: row.Competition ?? row.competition ?? undefined,
  };
}

async function fetchScoresSnapshot(
  fixtureId: number,
  participants: [string, string],
): Promise<RawTxLineScores | null> {
  try {
    const response = await fetch(
      `${getTxLineApiUrl()}/api/scores/snapshot/${fixtureId}`,
      {
        headers: txLineHeaders(),
        cache: "no-store",
        next: { revalidate: 0 },
      },
    );

    if (!response.ok) return null;

    const payload = await response.json();
    if (Array.isArray(payload) && payload.length > 0) {
      return payload[payload.length - 1] as RawTxLineScores;
    }
    if (payload && typeof payload === "object") {
      return payload as RawTxLineScores;
    }

    void participants;
    return null;
  } catch {
    return null;
  }
}

function applyScoresToFixture(
  fixture: DashboardFixture,
  scores: ReturnType<typeof normalizeScoresUpdate>,
): DashboardFixture {
  if (!scores) return fixture;

  const homeScore = scores.stats[STAT_KEY.P1_GOALS] ?? 0;
  const awayScore = scores.stats[STAT_KEY.P2_GOALS] ?? 0;

  let segment = fixture.segment;
  if (isInPlayGameState(scores.gameState)) {
    segment = "live";
  } else if (isFinishedGameState(scores.gameState)) {
    segment = "finished";
  } else if (gameStateFromString("NS") === scores.gameState && fixture.segment === "live") {
    segment = fixture.segment;
  }

  return {
    ...fixture,
    segment,
    homeScore,
    awayScore,
    matchMinute: scores.matchMinute,
    gameState: scores.gameState,
    isInPlay: isInPlayGameState(scores.gameState),
    endedTimeMs: isFinishedGameState(scores.gameState)
      ? scores.ts
      : fixture.endedTimeMs,
  };
}

export async function fetchTxLineDashboardFixtures(): Promise<DashboardFixture[]> {
  if (!hasTxLineCredentials()) {
    console.warn("[txline-fixtures] Missing credentials — returning empty dashboard");
    return [];
  }

  try {
    const url = new URL(`${getTxLineApiUrl()}/api/fixtures/snapshot`);
    const competitionId = process.env.TXLINE_COMPETITION_ID?.trim();
    if (competitionId) {
      url.searchParams.set("competitionId", competitionId);
    }

    const response = await fetch(url.toString(), {
      headers: txLineHeaders(),
      cache: "no-store",
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(
        `[txline-fixtures] snapshot HTTP ${response.status}`,
        await response.text().catch(() => ""),
      );
      return [];
    }

    const rows = (await response.json()) as TxLineFixtureRow[];
    const fixtures = rows
      .map(mapFixtureRow)
      .filter((fixture): fixture is DashboardFixture => fixture !== null)
      .sort((a, b) => a.id - b.id);

    const scoreCandidates = fixtures.filter(
      (f) => f.segment === "live" || f.segment === "finished",
    );
    const enriched = await Promise.all(
      scoreCandidates.map(async (fixture) => {
        const raw = await fetchScoresSnapshot(fixture.id, [fixture.home, fixture.away]);
        if (!raw) return fixture;
        const scores = normalizeScoresUpdate(raw, [fixture.home, fixture.away]);
        return applyScoresToFixture(fixture, scores);
      }),
    );

    const enrichedIds = new Set(enriched.map((f) => f.id));
    return fixtures.map((fixture) =>
      enrichedIds.has(fixture.id)
        ? enriched.find((f) => f.id === fixture.id)!
        : fixture,
    );
  } catch (error) {
    console.error("[txline-fixtures] fetch failed", error);
    return [];
  }
}
