const DEFAULT_TXLINE_API_URL = "https://txline-dev.txodds.com";

export function getTxLineApiUrl(): string {
  return process.env.TXLINE_API_URL?.trim() || DEFAULT_TXLINE_API_URL;
}

export function txLineHeaders(): HeadersInit {
  const jwt = process.env.TXLINE_JWT?.trim();
  const apiToken = process.env.TXLINE_API_TOKEN?.trim();

  if (!jwt || !apiToken) {
    throw new Error(
      "Missing TxLINE credentials: set TXLINE_JWT and TXLINE_API_TOKEN in environment",
    );
  }

  return {
    Authorization: `Bearer ${jwt}`,
    "X-Api-Token": apiToken,
    Accept: "application/json, text/event-stream",
  };
}

export function hasTxLineCredentials(): boolean {
  return Boolean(
    process.env.TXLINE_JWT?.trim() && process.env.TXLINE_API_TOKEN?.trim(),
  );
}
