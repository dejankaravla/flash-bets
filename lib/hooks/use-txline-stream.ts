"use client";

import { useEffect, useState } from "react";
import type { TxLineScoresUpdate, TxLineStreamMessage } from "@/lib/types/txline";

export type StreamStatus = "connecting" | "connected" | "error" | "closed";

export function useTxLineStream(fixtureId: string) {
  const [scores, setScores] = useState<TxLineScoresUpdate | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");

  useEffect(() => {
    if (!fixtureId) return;

    const source = new EventSource(
      `/api/stream?fixtureId=${encodeURIComponent(fixtureId)}`,
    );

    source.onopen = () => setStatus("connected");

    source.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as TxLineStreamMessage;
        if (msg.type === "scores") {
          setScores(msg.data);
        }
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

  return { scores, status };
}
