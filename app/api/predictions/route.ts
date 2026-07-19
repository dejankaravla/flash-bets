import { errorResponse } from "@/lib/server/errors";
import {
  listPredictionsForWallet,
  placePrediction,
} from "@/lib/server/prediction-service";
import { readJsonObject, requireSameOrigin } from "@/lib/server/request";
import { requireCurrentUser } from "@/lib/server/session";
import { readFlashPointsAccount } from "@/lib/server/flashpoints-service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(): Promise<Response> {
  try {
    const user = await requireCurrentUser();
    const predictions = await listPredictionsForWallet(user.wallet);
    const flashPoints = await readFlashPointsAccount(user.wallet);
    return Response.json(
      { predictions, flashPoints },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    const user = await requireCurrentUser();
    const body = await readJsonObject(request);
    const prediction = await placePrediction({
      wallet: user.wallet,
      marketId: body.marketId,
      side: body.side ?? body.selection,
      amount: body.amount ?? body.flashPoints,
    });
    const flashPoints = await readFlashPointsAccount(user.wallet);
    return Response.json(
      { prediction, flashPoints },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
