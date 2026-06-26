export type DashboardSegment = "live" | "upcoming" | "finished";

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
}

export function getFixturesBySegment(
  fixtures: DashboardFixture[],
  segment: DashboardSegment,
): DashboardFixture[] {
  return fixtures.filter((fixture) => fixture.segment === segment);
}
