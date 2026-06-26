"use client";

import { useCallback, useEffect, useState } from "react";

import { useAnchorProgram } from "@/lib/hooks/use-anchor-program";
import type { MockBet } from "@/lib/mock-bets";
import {
  MATCHED_TRADE_MAKER_OFFSET,
  MATCHED_TRADE_TAKER_OFFSET,
  ORDER_INTENT_MAKER_OFFSET,
} from "@/lib/txoracle/account-layout";
import {
  mapMatchedTradeToBet,
  mapOrderIntentToBet,
  readBetDisplayCache,
} from "@/lib/txoracle/map-bet";
import { getProgramAccounts } from "@/lib/txoracle/program-accounts";

interface UseUserBetsResult {
  activeBets: MockBet[];
  settledBets: MockBet[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function intentStateKey(state: Record<string, unknown>): string {
  return Object.keys(state)[0]?.toLowerCase() ?? "";
}

export function useUserBets(): UseUserBetsResult {
  const { program, publicKey, ready } = useAnchorProgram();
  const [fetchedActive, setFetchedActive] = useState<MockBet[]>([]);
  const [fetchedSettled, setFetchedSettled] = useState<MockBet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBets = useCallback(async () => {
    if (!program || !publicKey) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const walletBase58 = publicKey.toBase58();

      const accounts = getProgramAccounts(program);

      const [orderIntents, makerTrades, takerTrades] = await Promise.all([
        accounts.orderIntent.all([
          {
            memcmp: {
              offset: ORDER_INTENT_MAKER_OFFSET,
              bytes: walletBase58,
            },
          },
        ]),
        accounts.matchedTrade.all([
          {
            memcmp: {
              offset: MATCHED_TRADE_MAKER_OFFSET,
              bytes: walletBase58,
            },
          },
        ]),
        accounts.matchedTrade.all([
          {
            memcmp: {
              offset: MATCHED_TRADE_TAKER_OFFSET,
              bytes: walletBase58,
            },
          },
        ]),
      ]);

      const active: MockBet[] = [];
      const settled: MockBet[] = [];
      const seenTradeIds = new Set<string>();

      for (const row of orderIntents) {
        const pda = row.publicKey.toBase58();
        const cache = readBetDisplayCache(pda);
        const bet = mapOrderIntentToBet(pda, row.account as never, cache);
        const state = intentStateKey(
          row.account.state as Record<string, unknown>,
        );

        if (state === "active" || state === "locked") {
          active.push(bet);
        } else {
          settled.push(bet);
        }
      }

      const allTrades = [...makerTrades, ...takerTrades];
      for (const row of allTrades) {
        const tradeId = (row.account.tradeId as { toString: () => string }).toString();
        if (seenTradeIds.has(tradeId)) continue;
        seenTradeIds.add(tradeId);

        const pda = row.publicKey.toBase58();
        const cache = readBetDisplayCache(pda);
        const bet = mapMatchedTradeToBet(
          pda,
          row.account as never,
          walletBase58,
          cache,
        );
        const state = intentStateKey(
          row.account.state as Record<string, unknown>,
        );

        if (state === "resolved" || state === "closed" || state === "expired") {
          settled.push(bet);
        } else {
          active.push(bet);
        }
      }

      active.sort((a, b) => b.id.localeCompare(a.id));
      settled.sort((a, b) => b.id.localeCompare(a.id));

      setFetchedActive(active);
      setFetchedSettled(settled);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load on-chain bets";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [program, publicKey]);

  useEffect(() => {
    if (!ready) return;

    const initial = window.setTimeout(() => {
      void fetchBets();
    }, 0);

    const interval = setInterval(() => {
      void fetchBets();
    }, 15_000);

    const onFocus = () => {
      void fetchBets();
    };

    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready, fetchBets]);

  const activeBets = ready ? fetchedActive : [];
  const settledBets = ready ? fetchedSettled : [];

  return {
    activeBets,
    settledBets,
    isLoading: ready && isLoading,
    error: ready ? error : null,
    refetch: fetchBets,
  };
}
