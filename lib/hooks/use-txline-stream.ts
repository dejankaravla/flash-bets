"use client";

import { useCallback, useEffect, useState } from "react";
import type { TxLineScoresUpdate, TxLineStreamMessage } from "@/lib/types/txline";
import type { ReplayState } from "@/lib/replay/types";

export type StreamStatus = "connecting" | "connected" | "error" | "closed";

interface StreamState {
  key: string;
  scores: TxLineScoresUpdate | null;
  status: StreamStatus;
  replayState: ReplayState | null;
}

function initialStreamState(key: string): StreamState {
  return { key, scores: null, status: "connecting", replayState: null };
}

export function useTxLineStream(fixtureId: string) {
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const streamKey = `${fixtureId}:${connectionAttempt}`;
  const [stream, setStream] = useState<StreamState>(() => initialStreamState(streamKey));
  const current = stream.key === streamKey ? stream : initialStreamState(streamKey);
  const retry = useCallback(() => setConnectionAttempt((attempt) => attempt + 1), []);
  const setReplayState = useCallback((replayState: ReplayState | null) => {
    setStream((previous) => ({
      ...(previous.key === streamKey ? previous : initialStreamState(streamKey)),
      replayState,
    }));
  }, [streamKey]);

  useEffect(() => {
    if (!fixtureId) return;
    let receivedScores = false;
    const update = (change: Partial<Omit<StreamState, "key">>) => {
      setStream((previous) => ({
        ...(previous.key === streamKey ? previous : initialStreamState(streamKey)),
        ...change,
      }));
    };

    const source = new EventSource(
      `/api/stream?fixtureId=${encodeURIComponent(fixtureId)}`,
    );
    const initialTimeout = window.setTimeout(() => {
      if (!receivedScores) update({ status: "error" });
    }, 10_000);

    source.onopen = () => update({ status: "connected" });
    source.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as TxLineStreamMessage;
        if (msg.type === "scores") {
          receivedScores = true;
          window.clearTimeout(initialTimeout);
          update({ scores: msg.data, status: "connected" });
        } else if (msg.type === "replay-state") {
          update({ replayState: msg.data });
        }
      } catch {
        update({ status: "error" });
      }
    };
    source.onerror = () => {
      update({ status: source.readyState === EventSource.CLOSED ? "closed" : "error" });
    };

    return () => {
      window.clearTimeout(initialTimeout);
      source.close();
    };
  }, [fixtureId, connectionAttempt, streamKey]);

  return {
    scores: current.scores,
    status: current.status,
    replayState: current.replayState,
    setReplayState,
    retry,
  };
}
