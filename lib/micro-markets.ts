export type MicroMarketCardState = "open" | "locked" | "in_progress" | "closed";

export interface MicroMarket {
  windowStart: number;
  windowEnd: number;
  lockoutAtSeconds: number;
  windowStartSeconds: number;
  windowEndSeconds: number;
  proposition: string;
}

const PROPOSITION_TEMPLATES = [
  "Total Corners > 1.5",
  "Total Goals > 0.5",
  "Total Fouls > 3.5",
  "Yellow Cards > 0.5",
  "Shots on Target > 2.5",
  "Offsides > 1.5",
];

export function nextWindowStart(matchMinute: number): number {
  return Math.ceil((matchMinute + 1) / 5) * 5;
}

function propositionForWindow(windowStartMinute: number): string {
  const index = Math.floor(windowStartMinute / 5) % PROPOSITION_TEMPLATES.length;
  return PROPOSITION_TEMPLATES[index]!;
}

export function deriveMicroMarkets(matchMinute: number): MicroMarket[] {
  const first = nextWindowStart(matchMinute);

  return [0, 1, 2].map((i) => {
    const windowStart = first + i * 5;
    const windowEnd = windowStart + 5;
    const windowStartSeconds = windowStart * 60;
    const windowEndSeconds = windowEnd * 60;

    return {
      windowStart,
      windowEnd,
      lockoutAtSeconds: windowStartSeconds - 30,
      windowStartSeconds,
      windowEndSeconds,
      proposition: propositionForWindow(windowStart),
    };
  });
}

export function getCardState(
  market: MicroMarket,
  estimatedMatchSeconds: number,
  forceClosed = false,
): MicroMarketCardState {
  if (forceClosed) return "closed";

  const now = estimatedMatchSeconds;

  if (now >= market.windowEndSeconds) return "closed";
  if (now >= market.windowStartSeconds) return "in_progress";
  if (now >= market.lockoutAtSeconds) return "locked";
  return "open";
}

export function getLockoutCountdownSeconds(
  market: MicroMarket,
  estimatedMatchSeconds: number,
): number {
  return Math.max(0, market.lockoutAtSeconds - estimatedMatchSeconds);
}

export function formatMatchClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatWindowLabel(windowStart: number, windowEnd: number): string {
  return `${windowStart}' – ${windowEnd}'`;
}

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function computePoolSplit(scoresSeq: number): {
  yesPct: number;
  noPct: number;
} {
  const yesPct = 50 + 30 * Math.sin(scoresSeq * 0.15);
  const clamped = Math.max(20, Math.min(80, yesPct));
  return { yesPct: clamped, noPct: 100 - clamped };
}

export function computePoolTotalUsdc(scoresSeq: number): number {
  return 1200 + scoresSeq * 37;
}

export function getCardStateLabel(state: MicroMarketCardState): string | null {
  switch (state) {
    case "locked":
      return "LOCKOUT";
    case "in_progress":
      return "IN-PROGRESS";
    case "closed":
      return "CLOSED";
    default:
      return null;
  }
}
