import { readFile } from "node:fs/promises";
import path from "node:path";

import type { LegacyFlashBetsState } from "../lib/domain/flash-bets.ts";
import { disconnectMongo } from "../lib/server/db/mongoose.ts";
import { migrateLegacyState } from "../lib/server/migration-service.ts";

async function main(): Promise<void> {
  const configured = process.env.FLASHBETS_JSON_MIGRATION_PATH?.trim();
  const sourcePath = path.resolve(process.cwd(), configured || ".data/flash-bets-foundation.json");
  const relative = path.relative(process.cwd(), sourcePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("FLASHBETS_JSON_MIGRATION_PATH must stay inside the workspace");
  }

  try {
    const raw = await readFile(sourcePath, "utf8");
    const state = JSON.parse(raw) as LegacyFlashBetsState;
    const summary = await migrateLegacyState(state);
    console.log(JSON.stringify({ sourcePath, summary }, null, 2));
  } finally {
    await disconnectMongo();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
