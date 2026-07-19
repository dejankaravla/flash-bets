"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FlashPointsAccount, PredictionView } from "@/lib/domain/flash-bets";
import { readApiError } from "@/lib/client-errors";
import { useWalletAuth } from "@/lib/hooks/use-wallet-auth";

export function usePredictions() {
  const { authenticated, refresh: refreshAuth } = useWalletAuth();
  const [predictions, setPredictions] = useState<PredictionView[]>([]);
  const [flashPoints, setFlashPoints] = useState<FlashPointsAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setPredictions([]);
      setFlashPoints(null);
      setLoading(false);
      return;
    }
    if (inFlight.current) return inFlight.current;

    const request = (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/predictions", { cache: "no-store" });
        if (!response.ok) {
          const message = await readApiError(response, "Your predictions could not be loaded. Try again.");
          if (response.status === 401) await refreshAuth();
          throw new Error(message);
        }
        const payload = (await response.json()) as {
          predictions: PredictionView[];
          flashPoints: FlashPointsAccount;
        };
        setPredictions(payload.predictions);
        setFlashPoints(payload.flashPoints);
        setError(null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Your predictions could not be loaded. Try again.");
      } finally {
        setLoading(false);
      }
    })();

    inFlight.current = request;
    try {
      await request;
    } finally {
      if (inFlight.current === request) inFlight.current = null;
    }
  }, [authenticated, refreshAuth]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    if (!authenticated) return () => { active = false; };

    const source = new EventSource("/api/activity");
    source.onmessage = (event) => {
      try {
        const activity = JSON.parse(event.data) as { type?: string };
        if (activity.type !== "ready") void refresh();
      } catch {
        // Ignore malformed activity messages; EventSource reconnects automatically.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      source.close();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authenticated, refresh]);

  return { predictions, flashPoints, loading, error, refresh };
}
