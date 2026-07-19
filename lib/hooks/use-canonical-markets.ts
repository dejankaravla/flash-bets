"use client";

import { useCallback, useEffect, useState } from "react";

import type { Fixture, Market } from "@/lib/domain/flash-bets";
import { readApiError } from "@/lib/client-errors";

interface CanonicalMarketResponse {
  fixture: Fixture | null;
  fixtureFresh: boolean;
  markets: Market[];
}

export function useCanonicalMarkets(fixtureId: string, scoresSequence: number | null) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [fixtureFresh, setFixtureFresh] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!fixtureId) return;
    try {
      const response = await fetch(
        `/api/markets?fixtureId=${encodeURIComponent(fixtureId)}`,
        { cache: "no-store", signal },
      );
      if (!response.ok) throw new Error(await readApiError(response, "Markets are temporarily unavailable. Try again."));
      const data = (await response.json()) as CanonicalMarketResponse;
      setMarkets(data.markets);
      setFixture(data.fixture);
      setFixtureFresh(data.fixtureFresh);
      setError(null);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setFixtureFresh(false);
      setError(reason instanceof Error ? reason.message : "Markets are temporarily unavailable. Try again.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [fixtureId]);

  const refresh = useCallback(() => load(), [load]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), scoresSequence === null ? 0 : 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, scoresSequence]);

  return { markets, fixture, fixtureFresh, isLoading, error, refresh };
}
