import { errorResponse } from "@/lib/server/errors";
import { ApiError } from "@/lib/server/errors";
import { readJsonObject, requireSameOrigin } from "@/lib/server/request";
import { selectReplay } from "@/lib/server/replay/replay-service";
import { requireCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    await requireCurrentUser();
    const body = await readJsonObject(request);
    if (typeof body.replayId !== "string") throw new ApiError("INVALID_REPLAY", "A replayId is required", 400);
    const state = await selectReplay(body.replayId);
    return Response.json({ state }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
