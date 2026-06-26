"use client";

import { useEffect, useState } from "react";
import {
  COUNTDOWN_URGENT_MS,
  formatCountdown,
  getMatchWindowRemainingMs,
} from "@/lib/match-window";

export function useMatchWindowCountdown(startTimeMs: number | undefined) {
  const [remainingMs, setRemainingMs] = useState(() =>
    startTimeMs ? getMatchWindowRemainingMs(startTimeMs) : 0,
  );

  useEffect(() => {
    if (!startTimeMs) return;

    const tick = () => setRemainingMs(getMatchWindowRemainingMs(startTimeMs));

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTimeMs]);

  if (!startTimeMs) {
    return { label: null, isEnded: false, isUrgent: false };
  }

  const isEnded = remainingMs <= 0;
  const isUrgent = !isEnded && remainingMs < COUNTDOWN_URGENT_MS;

  return {
    label: isEnded ? "Ended" : `Ends in ${formatCountdown(remainingMs)}`,
    isEnded,
    isUrgent,
  };
}
