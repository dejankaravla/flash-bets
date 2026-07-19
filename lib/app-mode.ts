export type FlashBetsMode = "LIVE" | "REPLAY";

export function flashBetsMode(value = process.env.FLASHBETS_MODE): FlashBetsMode {
  return value?.trim().toUpperCase() === "REPLAY" ? "REPLAY" : "LIVE";
}

