import { errorResponse } from "@/lib/server/errors";
import { requireSameOrigin } from "@/lib/server/request";
import { runSettlement } from "@/lib/server/settlement-service";
import { requireCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  try {
    requireSameOrigin(request);
    const user = await requireCurrentUser();
    const result = await runSettlement();
    return Response.json(
      { triggeredBy: user.wallet, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
