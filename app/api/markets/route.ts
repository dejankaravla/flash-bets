import { listCanonicalMarkets } from "@/lib/server/market-service";
import { ApiError, errorResponse } from "@/lib/server/errors";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request): Promise<Response> {
  try {
    const fixtureId = new URL(request.url).searchParams.get("fixtureId")?.trim();
    if (!fixtureId || !/^\d+$/.test(fixtureId)) {
      throw new ApiError("INVALID_FIXTURE", "A numeric fixtureId is required", 400);
    }
    return Response.json(await listCanonicalMarkets(fixtureId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
