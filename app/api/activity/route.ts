import { errorResponse } from "@/lib/server/errors";
import { subscribeWalletActivity } from "@/lib/server/activity-stream";
import { requireCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireCurrentUser();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "ready" })}\n\n`));
        const unsubscribe = subscribeWalletActivity(user.wallet, (activity) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(activity)}\n\n`));
        });
        const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 30_000);
        request.signal.addEventListener("abort", () => {
          unsubscribe();
          clearInterval(heartbeat);
          try { controller.close(); } catch { /* Already closed. */ }
        }, { once: true });
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
  } catch (error) {
    return errorResponse(error);
  }
}

