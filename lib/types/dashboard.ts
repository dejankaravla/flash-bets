export type DashboardSegment = "live" | "replay" | "upcoming" | "finished" | "unavailable";

export interface DashboardFixture {
  id: number;
  home: string;
  away: string;
  segment: DashboardSegment;
  homeScore?: number;
  awayScore?: number;
  kickoffLabel?: string;
  group?: string;
  startTimeMs?: number;
  endedTimeMs?: number;
  matchMinute?: number;
  gameState?: number;
  isInPlay?: boolean;
  availabilityReason?: string;
  sourceMode?: "LIVE" | "REPLAY";
  replayId?: string;
  replayStatus?: "AVAILABLE" | "PAUSED" | "PLAYING" | "FINISHED";
  replayTitle?: string;
}

export function getFixturesBySegment(
  fixtures: DashboardFixture[],
  segment: DashboardSegment,
): DashboardFixture[] {
  return fixtures.filter((fixture) => fixture.segment === segment);
}
