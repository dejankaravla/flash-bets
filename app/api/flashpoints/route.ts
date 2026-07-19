import { errorResponse } from "@/lib/server/errors";
import { requireCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const user = await requireCurrentUser();
    return Response.json(
      { flashPoints: user.flashPoints },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
