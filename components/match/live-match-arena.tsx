"use client";

import { useCallback, useMemo, useState } from "react";
import { LiveMatchHeader } from "@/components/match/live-match-header";
import { MicroMarketCard } from "@/components/match/micro-market-card";
import { PredictionBottomSheet } from "@/components/match/prediction-bottom-sheet";
import { Toast } from "@/components/ui/toast";
import { useMatchClock } from "@/lib/hooks/use-match-clock";
import { useTxLineStream } from "@/lib/hooks/use-txline-stream";
import { deriveMicroMarkets, type MicroMarket } from "@/lib/micro-markets";
import { GAME_PHASE } from "@/lib/types/txline";
import { truncateAddress } from "@/lib/wallet";

interface LiveMatchArenaProps {
  fixtureId: string;
}

export function LiveMatchArena({ fixtureId }: LiveMatchArenaProps) {
  const { scores, status } = useTxLineStream(fixtureId);
  const estimatedMatchSeconds = useMatchClock(scores);
  const [selectedMarket, setSelectedMarket] = useState<MicroMarket | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const markets = useMemo(
    () => (scores ? deriveMicroMarkets(scores.matchMinute) : []),
    [scores],
  );

  const forceClosed =
    scores?.gameState === GAME_PHASE.HT ||
    scores?.gameState === GAME_PHASE.F;

  const matchLabel = scores
    ? `${scores.participants[0]} vs ${scores.participants[1]}`
    : undefined;

  const handleConfirm = useCallback(
    (selection: "yes" | "no", amount: number, txSignature?: string) => {
      const txNote = txSignature
        ? ` · ${truncateAddress(txSignature, 6)}`
        : "";
      setToastMessage(
        `On-chain intent: ${selection.toUpperCase()} · ${amount} TxL${txNote}`,
      );
    },
    [],
  );

  const dismissToast = useCallback(() => setToastMessage(null), []);

  if (status === "connecting" && !scores) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-zinc-500">Connecting to live stream…</p>
      </div>
    );
  }

  if (!scores) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-red-400">Stream unavailable</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <LiveMatchHeader
        scores={scores}
        estimatedMatchSeconds={estimatedMatchSeconds}
      />

      <main className="flex-1 px-4 py-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Micro-Markets
        </h2>
        <div className="flex flex-col gap-3">
          {markets.map((market) => (
            <MicroMarketCard
              key={`${market.windowStart}-${market.windowEnd}`}
              market={market}
              estimatedMatchSeconds={estimatedMatchSeconds}
              scoresSeq={scores.seq}
              forceClosed={forceClosed}
              onSelect={setSelectedMarket}
            />
          ))}
        </div>

        <div className="h-24" />
      </main>

      {selectedMarket && (
        <PredictionBottomSheet
          fixtureId={fixtureId}
          market={selectedMarket}
          gameState={scores.gameState}
          estimatedMatchSeconds={estimatedMatchSeconds}
          matchLabel={matchLabel}
          onClose={() => setSelectedMarket(null)}
          onConfirm={handleConfirm}
        />
      )}

      <Toast
        message={toastMessage ?? ""}
        visible={toastMessage !== null}
        onDismiss={dismissToast}
      />
    </div>
  );
}
