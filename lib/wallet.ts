export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function buildPredictionSignMessage(params: {
  fixtureId: number;
  windowLabel: string;
  proposition: string;
  selection: "yes" | "no";
  amountUsdc: number;
}): Uint8Array {
  const text = [
    "FlashBets Prediction",
    `fixture:${params.fixtureId}`,
    `window:${params.windowLabel}`,
    `market:${params.proposition}`,
    `side:${params.selection.toUpperCase()}`,
    `amount:${params.amountUsdc} USDC`,
  ].join("\n");
  return new TextEncoder().encode(text);
}
