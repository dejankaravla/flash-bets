import { revokeSession } from "@/lib/server/auth-service";
import { errorResponse } from "@/lib/server/errors";
import { requireSameOrigin } from "@/lib/server/request";
import { clearSessionCookie, sessionToken } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    await revokeSession(await sessionToken());
    await clearSessionCookie();
    return Response.json(
      { authenticated: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
