import "server-only";

import { connectMongo } from "@/lib/server/db/mongoose";
import { allFlashBetsModels } from "@/lib/server/db/models";

export async function clearFlashBetsCollections(): Promise<void> {
  await connectMongo();
  for (const model of allFlashBetsModels) await model.deleteMany({});
}

export async function flashBetsCollectionCounts(): Promise<Record<string, number>> {
  await connectMongo();
  const entries = await Promise.all(
    allFlashBetsModels.map(async (model) => [model.collection.collectionName, await model.countDocuments({})] as const),
  );
  return Object.fromEntries(entries);
}
