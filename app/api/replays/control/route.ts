import { ApiError, errorResponse } from "@/lib/server/errors";
import { readJsonObject, requireSameOrigin } from "@/lib/server/request";
import { controlReplay } from "@/lib/server/replay/replay-service";
import { requireCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    await requireCurrentUser();
    const body = await readJsonObject(request);
    if (!(["PLAY", "PAUSE", "RESTART", "SPEED"] as unknown[]).includes(body.action)) {
      throw new ApiError("INVALID_REPLAY_ACTION", "A valid replay action is required", 400);
    }
    const state = await controlReplay({
      action: body.action as "PLAY" | "PAUSE" | "RESTART" | "SPEED",
      speed: typeof body.speed === "number" ? body.speed : undefined,
    });
    return Response.json({ state }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
