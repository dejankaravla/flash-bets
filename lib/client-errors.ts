interface ApiErrorPayload {
  error?: string;
  code?: string;
}

const FRIENDLY_ERRORS: Record<string, string> = {
  UNAUTHENTICATED: "Your FlashBets session expired. Sign in again to continue.",
  UNAVAILABLE: "FlashBets cannot reach its data store right now. Try again in a moment.",
  REPLAY_MODE_DISABLED: "Replay Mode is not enabled on this server.",
  REPLAY_NOT_SELECTED: "Choose a replay from the Matches page first.",
  REPLAY_NOT_FOUND: "That replay is unavailable. Choose another replay from Matches.",
  INVALID_REPLAY_ACTION: "That replay control is unavailable. Refresh and try again.",
  INVALID_REPLAY_SPEED: "Choose one of the available replay speeds.",
  UNKNOWN_MARKET: "This market is no longer available. Return to the match and choose another.",
  MARKET_NOT_OPEN: "Betting has closed for this window. Choose another open market.",
  FIXTURE_NOT_FRESH: "Match data is delayed, so predictions are temporarily locked.",
  PREDICTION_EXISTS: "You already predicted on this market.",
  INSUFFICIENT_FLASHPOINTS: "You do not have enough available FlashPoints for this prediction.",
  INVALID_FLASHPOINTS: "Enter a positive whole number of FlashPoints.",
  INVALID_SELECTION: "Choose Yes or No before placing your prediction.",
  CHALLENGE_EXPIRED: "The sign-in request expired. Start sign-in again.",
  CHALLENGE_USED: "That sign-in request was already used. Start sign-in again.",
  INVALID_SIGNATURE: "The wallet signature could not be verified. Try signing in again.",
};

export async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    if (payload.code && FRIENDLY_ERRORS[payload.code]) return FRIENDLY_ERRORS[payload.code];
    if (payload.error && !payload.error.includes("HTTP")) return payload.error;
  } catch {
    // A non-JSON response is handled by the friendly fallback below.
  }
  return fallback;
}
