export const MATCH_WINDOW_MS = 105 * 60 * 1000;

export const COUNTDOWN_URGENT_MS = 15 * 60 * 1000;

export function getMatchWindowEndMs(startTimeMs: number): number {
  return startTimeMs + MATCH_WINDOW_MS;
}

export function getMatchWindowRemainingMs(
  startTimeMs: number,
  now = Date.now(),
): number {
  return Math.max(0, getMatchWindowEndMs(startTimeMs) - now);
}

export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return "Ended";

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatMatchDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(epochMs));
}
