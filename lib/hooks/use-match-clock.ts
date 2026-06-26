"use client";

import { useEffect, useState } from "react";
import type { TxLineScoresUpdate } from "@/lib/types/txline";

const MAX_EXTRAPOLATION_SECONDS = 15;
const STALE_TICK_MS = 20_000;

export function useMatchClock(scores: TxLineScoresUpdate | null) {
  const [estimatedMatchSeconds, setEstimatedMatchSeconds] = useState(0);

  useEffect(() => {
    if (!scores) return;

    const baseline = scores.matchMinute * 60;
    const syncedAt = Date.now();

    const tick = () => {
      const wallNow = Date.now();
      const elapsed = Math.floor((wallNow - syncedAt) / 1000);
      const extrapolated = Math.min(elapsed, MAX_EXTRAPOLATION_SECONDS);
      const isStale = wallNow - syncedAt > STALE_TICK_MS;

      setEstimatedMatchSeconds(
        isStale ? baseline : baseline + extrapolated,
      );
    };

    const interval = setInterval(tick, 1000);
    tick();

    return () => clearInterval(interval);
  }, [scores]);

  return scores ? estimatedMatchSeconds : 0;
}
