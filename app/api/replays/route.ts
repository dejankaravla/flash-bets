import { flashBetsMode } from "@/lib/app-mode";
import { listReplaySummaries } from "@/lib/server/replay/replay-loader";
import { currentReplayState } from "@/lib/server/replay/replay-service";
import { errorResponse, ApiError } from "@/lib/server/errors";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(): Promise<Response> {
  try {
    return Response.json(
      { mode: flashBetsMode(), replays: await listReplaySummaries(), active: currentReplayState() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[ReplayCatalog] replay catalog could not be loaded");
    return errorResponse(new ApiError("REPLAY_CATALOG_INVALID", "The replay catalog contains a missing or invalid dataset", 503));
  }
}
