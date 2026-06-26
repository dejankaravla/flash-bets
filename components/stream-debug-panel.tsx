"use client";

import { useEffect, useState } from "react";
import {
  GAME_PHASE_LABEL,
  STAT_KEY,
  type TxLineOddsUpdate,
  type TxLineScoresUpdate,
  type TxLineStreamMessage,
} from "@/lib/types/txline";

type ConnectionStatus = "connecting" | "connected" | "error" | "closed";

const MAX_LOG_ENTRIES = 20;

function formatScore(scores: TxLineScoresUpdate): string {
  const home = scores.stats[STAT_KEY.P1_GOALS] ?? 0;
  const away = scores.stats[STAT_KEY.P2_GOALS] ?? 0;
  return `${home} – ${away}`;
}

function formatEvent(scores: TxLineScoresUpdate): string | null {
  if (!scores.event) return null;
  const team = scores.participants[scores.event.teamIndex];
  const player = scores.event.player ? ` (${scores.event.player})` : "";
  return `${scores.event.type.replace("_", " ")} — ${team}${player}`;
}

interface StreamDebugPanelProps {
  fixtureId: string;
}

export function StreamDebugPanel({ fixtureId }: StreamDebugPanelProps) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [scores, setScores] = useState<TxLineScoresUpdate | null>(null);
  const [odds, setOdds] = useState<TxLineOddsUpdate | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    const source = new EventSource(
      `/api/stream?fixtureId=${encodeURIComponent(fixtureId)}`,
    );

    source.onopen = () => setStatus("connected");

    source.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as TxLineStreamMessage;

        if (msg.type === "scores") setScores(msg.data);
        if (msg.type === "odds") setOdds(msg.data);

        setLog((prev) =>
          [JSON.stringify(msg, null, 2), ...prev].slice(0, MAX_LOG_ENTRIES),
        );
      } catch {
        setStatus("error");
      }
    };

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        setStatus("closed");
      } else {
        setStatus("error");
      }
    };

    return () => {
      source.close();
      setStatus("closed");
    };
  }, [fixtureId]);

  const statusColor: Record<ConnectionStatus, string> = {
    connecting: "text-amber-600 dark:text-amber-400",
    connected: "text-emerald-600 dark:text-emerald-400",
    error: "text-red-600 dark:text-red-400",
    closed: "text-zinc-500",
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            status === "connected"
              ? "bg-emerald-500"
              : status === "connecting"
                ? "bg-amber-500 animate-pulse"
                : "bg-zinc-400"
          }`}
        />
        <span className={statusColor[status]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {scores && (
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Live Scores
          </h2>
          <p className="text-2xl font-semibold">
            {scores.participants[0]} vs {scores.participants[1]}
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums">
            {formatScore(scores)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-zinc-500">Minute</dt>
              <dd className="font-medium">{scores.matchMinute}&apos;</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Phase</dt>
              <dd className="font-medium">
                {GAME_PHASE_LABEL[scores.gameState] ?? scores.gameState}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Corners</dt>
              <dd className="font-medium tabular-nums">
                {scores.stats[STAT_KEY.P1_CORNERS] ?? 0} –{" "}
                {scores.stats[STAT_KEY.P2_CORNERS] ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Cards</dt>
              <dd className="font-medium tabular-nums">
                Y{(scores.stats[STAT_KEY.P1_YELLOW] ?? 0) +
                  (scores.stats[STAT_KEY.P2_YELLOW] ?? 0)}{" "}
                R{(scores.stats[STAT_KEY.P1_RED] ?? 0) +
                  (scores.stats[STAT_KEY.P2_RED] ?? 0)}
              </dd>
            </div>
          </dl>
          {formatEvent(scores) && (
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm dark:bg-zinc-800">
              Last event: {formatEvent(scores)}
            </p>
          )}
        </section>
      )}

      {odds && (
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Odds
          </h2>
          <div className="flex flex-col gap-4">
            {odds.markets.map((market) => (
              <div key={market.marketId}>
                <p className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {market.marketId}
                </p>
                <div className="flex flex-wrap gap-2">
                  {market.selections.map((sel) => (
                    <span
                      key={sel.name}
                      className="rounded-lg bg-white px-3 py-1.5 text-sm dark:bg-zinc-800"
                    >
                      {sel.name}{" "}
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {sel.price.toFixed(2)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-sm text-zinc-500 underline-offset-2 hover:underline"
        >
          {showRaw ? "Hide" : "Show"} raw JSON log ({log.length})
        </button>
        {showRaw && (
          <pre className="mt-3 max-h-80 overflow-auto rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-xs text-zinc-300 dark:border-zinc-800">
            {log.join("\n\n---\n\n") || "Waiting for events…"}
          </pre>
        )}
      </section>
    </div>
  );
}
