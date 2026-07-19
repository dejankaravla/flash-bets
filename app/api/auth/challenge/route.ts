import { createWalletChallenge } from "@/lib/server/auth-service";
import { errorResponse } from "@/lib/server/errors";
import { readJsonObject, requireSameOrigin } from "@/lib/server/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    const body = await readJsonObject(request);
    const challenge = await createWalletChallenge(
      body.wallet,
      new URL(request.url).origin,
    );
    return Response.json(
      {
        challengeId: challenge.challengeId,
        message: challenge.message,
        expiresAt: challenge.expiresAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
