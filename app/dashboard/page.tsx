import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { fetchTxLineDashboardFixtures } from "@/lib/txline-fixtures";
import { hasTxLineCredentials } from "@/lib/txline-auth";
import { flashBetsMode } from "@/lib/app-mode";
import type { Fixture } from "@/lib/domain/flash-bets";
import { listCompletedFixtures } from "@/lib/server/repositories/fixture-repository";
import { listReplayDashboardFixtures } from "@/lib/server/replay/replay-service";
import type { DashboardFixture } from "@/lib/types/dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Matches · FlashBets",
  description: "Choose a live fixture or historical replay and open five-minute markets.",
};

function completedLiveFixture(fixture: Fixture): DashboardFixture | null {
  const id = Number(fixture.fixtureId);
  if (!Number.isSafeInteger(id)) return null;
  const endedTimeMs = Date.parse(fixture.updatedAt);
  return {
    id,
    home: fixture.participants[0],
    away: fixture.participants[1],
    segment: "finished",
    endedTimeMs: Number.isFinite(endedTimeMs) ? endedTimeMs : undefined,
    group: "TxLINE history",
    isInPlay: false,
    sourceMode: "LIVE",
  };
}

async function listLiveDashboardFixtures(): Promise<DashboardFixture[]> {
  const currentRequest = fetchTxLineDashboardFixtures();
  const historyRequest = listCompletedFixtures("LIVE").catch(() => {
    console.error("[Dashboard] completed fixture history unavailable");
    return [];
  });
  const [current, completed] = await Promise.all([currentRequest, historyRequest]);
  const currentIds = new Set(current.map((fixture) => String(fixture.id)));
  const history = completed
    .filter((fixture) => !currentIds.has(fixture.fixtureId))
    .map(completedLiveFixture)
    .filter((fixture): fixture is DashboardFixture => fixture !== null);
  return [...current, ...history];
}

export default async function DashboardPage() {
  const mode = flashBetsMode();
  let sourceError: string | undefined;
  let fixtures: DashboardFixture[] = [];
  try {
    fixtures = mode === "REPLAY"
      ? await listReplayDashboardFixtures()
      : await listLiveDashboardFixtures();
  } catch {
    console.error("[Dashboard] fixture source unavailable");
    sourceError = mode === "REPLAY"
      ? "The replay library is temporarily unavailable."
      : "Live fixtures are temporarily unavailable.";
  }

  return <DashboardContent fixtures={fixtures} mode={mode} sourceError={sourceError} txLineConfigured={mode === "REPLAY" || hasTxLineCredentials()} />;
}
