import { txLineClient } from "@/lib/txLineClient";
import { hasTxLineCredentials } from "@/lib/txline-auth";
import { flashBetsMode } from "@/lib/app-mode";
import {
  hasActiveReplayFixture,
  subscribeReplay,
} from "@/lib/server/replay/replay-service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const fixtureId = searchParams.get("fixtureId");

  if (!fixtureId || !/^\d+$/.test(fixtureId)) {
    return new Response("A numeric fixtureId query parameter is required", {
      status: 400,
    });
  }
  const mode = flashBetsMode();
  if (mode === "LIVE" && !hasTxLineCredentials()) {
    return Response.json(
      { error: "TxLINE is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (mode === "REPLAY" && !hasActiveReplayFixture(fixtureId)) {
    return Response.json(
      { error: "This replay fixture is no longer active. Choose a replay from the dashboard." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const subscribe = mode === "REPLAY" ? subscribeReplay : txLineClient.subscribe.bind(txLineClient);
      const unsubscribe = subscribe(fixtureId, (msg) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(msg)}\n\n`),
        );
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30_000);

      const cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
