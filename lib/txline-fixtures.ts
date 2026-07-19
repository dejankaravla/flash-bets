import {
  getTxLineApiUrl,
  hasTxLineCredentials,
  txLineHeaders,
} from "@/lib/txline-auth";
import { formatMatchDateTime } from "@/lib/match-window";
import {
  normalizeScoresUpdate,
  type RawTxLineScores,
} from "@/lib/txline-normalize";
import { STAT_KEY } from "@/lib/types/txline";
import type { DashboardFixture } from "@/lib/types/dashboard";

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
}

function toEpochMs(value: number): number {
  return value < 1_000_000_000_000 ? value * 1_000 : value;
}

function staleAfterMs(): number {
  const configured = Number(process.env.FLASHBETS_TXLINE_STALE_AFTER_SECONDS);
  const seconds = Number.isInteger(configured) && configured > 0 ? configured : 45;
  return seconds * 1_000;
}

function mapFixtureRow(row: TxLineFixtureRow): DashboardFixture | null {
  const id = row.FixtureId ?? row.fixtureId;
  const startRaw = row.StartTime ?? row.startTime;
  if (id === undefined || startRaw === undefined) return null;
  const p1 = row.Participant1 ?? row.participant1 ?? "TBD";
  const p2 = row.Participant2 ?? row.participant2 ?? "TBD";
  const p1Home = row.Participant1IsHome ?? row.participant1IsHome ?? true;
  const startTimeMs = toEpochMs(startRaw);
  const upcoming = startTimeMs > Date.now();
  return {
    id,
    home: p1Home ? p1 : p2,
    away: p1Home ? p2 : p1,
    segment: upcoming ? "upcoming" : "unavailable",
    startTimeMs,
    kickoffLabel: formatMatchDateTime(startTimeMs),
    group: row.Competition ?? row.competition ?? undefined,
    availabilityReason: upcoming ? undefined : "Awaiting an authoritative TxLINE state",
  };
}

async function fetchScoresSnapshot(fixtureId: number): Promise<RawTxLineScores | null> {
  try {
    const response = await fetch(`${getTxLineApiUrl()}/api/scores/snapshot/${fixtureId}`, {
      headers: txLineHeaders(),
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (Array.isArray(payload) && payload.length > 0) return payload[payload.length - 1] as RawTxLineScores;
    return payload && typeof payload === "object" ? (payload as RawTxLineScores) : null;
  } catch {
    return null;
  }
}

function applyScores(fixture: DashboardFixture, raw: RawTxLineScores | null): DashboardFixture {
  if (!raw) return fixture;
  const scores = normalizeScoresUpdate(raw, [fixture.home, fixture.away]);
  if (!scores) return fixture;
  const homeScore = scores.stats[STAT_KEY.P1_GOALS];
  const awayScore = scores.stats[STAT_KEY.P2_GOALS];
  const sourceMs = toEpochMs(scores.ts);
  const sourceFresh =
    scores.sourceTimestampTrusted &&
    Date.now() >= sourceMs &&
    Date.now() - sourceMs <= staleAfterMs();

  if (scores.matchPhase === "FINISHED") {
    return { ...fixture, segment: "finished", homeScore, awayScore, gameState: scores.gameState, isInPlay: false, endedTimeMs: sourceMs, availabilityReason: undefined };
  }
  if (
    scores.matchPhase === "FIRST_HALF" ||
    scores.matchPhase === "HALFTIME" ||
    scores.matchPhase === "SECOND_HALF"
  ) {
    if (!sourceFresh) {
      return { ...fixture, segment: "unavailable", homeScore, awayScore, gameState: scores.gameState, isInPlay: false, availabilityReason: "Latest TxLINE live state is stale" };
    }
    return { ...fixture, segment: "live", homeScore, awayScore, matchMinute: scores.matchMinute, gameState: scores.gameState, isInPlay: true, availabilityReason: undefined };
  }
  if (scores.matchPhase === "NOT_STARTED") {
    return { ...fixture, segment: "upcoming", homeScore, awayScore, gameState: scores.gameState, isInPlay: false, availabilityReason: undefined };
  }
  return {
    ...fixture,
    segment: "unavailable",
    homeScore,
    awayScore,
    gameState: scores.gameState,
    isInPlay: false,
    availabilityReason:
      scores.matchPhase === "UNKNOWN"
        ? "TxLINE match state is unavailable"
        : `TxLINE reports ${scores.matchPhase.toLowerCase().replaceAll("_", " ")}`,
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
    if (competitionId) url.searchParams.set("competitionId", competitionId);
    const response = await fetch(url.toString(), {
      headers: txLineHeaders(),
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!response.ok) {
      console.error(`[txline-fixtures] snapshot HTTP ${response.status}`);
      return [];
    }
    const rows = (await response.json()) as TxLineFixtureRow[];
    const fixtures = rows.map(mapFixtureRow).filter((fixture): fixture is DashboardFixture => fixture !== null);
    return Promise.all(
      fixtures
        .sort((left, right) => (left.startTimeMs ?? 0) - (right.startTimeMs ?? 0))
        .map(async (fixture) => applyScores(fixture, await fetchScoresSnapshot(fixture.id))),
    );
  } catch {
    console.error("[txline-fixtures] fetch failed");
    return [];
  }
}
