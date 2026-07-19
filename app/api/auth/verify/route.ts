import { verifyWalletChallenge } from "@/lib/server/auth-service";
import { errorResponse } from "@/lib/server/errors";
import { readJsonObject, requireSameOrigin } from "@/lib/server/request";
import { setSessionCookie } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    const body = await readJsonObject(request);
    const verified = await verifyWalletChallenge({
      challengeId: body.challengeId,
      wallet: body.wallet,
      signature: body.signature,
      origin: new URL(request.url).origin,
    });
    await setSessionCookie(verified.token, verified.user.sessionExpiresAt);
    return Response.json(
      { authenticated: true, user: verified.user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
