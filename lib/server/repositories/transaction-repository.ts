import "server-only";

import type { ClientSession } from "mongoose";

import { withMongoTransaction } from "@/lib/server/db/mongoose";

export function runInTransaction<T>(
  operation: (session?: ClientSession) => Promise<T>,
): Promise<T> {
  return withMongoTransaction(operation);
}
