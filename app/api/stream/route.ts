import { txLineClient } from "@/lib/txLineClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const fixtureId = searchParams.get("fixtureId");

  if (!fixtureId) {
    return new Response("Missing fixtureId query parameter", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = txLineClient.subscribe(fixtureId, (msg) => {
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
