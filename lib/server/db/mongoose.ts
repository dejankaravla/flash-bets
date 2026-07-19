import "server-only";

import mongoose, { type ClientSession } from "mongoose";

import { allFlashBetsModels } from "@/lib/server/db/models";

const DEFAULT_MONGODB_URI = "mongodb://127.0.0.1:27017/flashbets";

interface MongoCache {
  uri?: string;
  connection?: Promise<typeof mongoose>;
  indexes?: Promise<void>;
  transactionSupport?: Promise<boolean>;
}

const globalMongo = globalThis as typeof globalThis & {
  __flashBetsMongo?: MongoCache;
};

const cache = (globalMongo.__flashBetsMongo ??= {});

export function mongodbUri(): string {
  return process.env.MONGODB_URI?.trim() || DEFAULT_MONGODB_URI;
}

export async function connectMongo(): Promise<typeof mongoose> {
  const uri = mongodbUri();
  if (cache.uri && cache.uri !== uri) {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    cache.connection = undefined;
    cache.indexes = undefined;
    cache.transactionSupport = undefined;
  }
  cache.uri = uri;
  cache.connection ??= mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5_000,
    maxPoolSize: 10,
  });
  const connection = await cache.connection;
  cache.indexes ??= Promise.all(allFlashBetsModels.map((model) => model.init())).then(
    () => undefined,
  );
  await cache.indexes;
  return connection;
}

export async function mongoSupportsTransactions(): Promise<boolean> {
  const connection = await connectMongo();
  cache.transactionSupport ??= (async () => {
    const database = connection.connection.db;
    if (!database) return false;
    const hello = await database.admin().command({ hello: 1 }) as {
      setName?: string;
      msg?: string;
      logicalSessionTimeoutMinutes?: number;
    };
    return (
      typeof hello.logicalSessionTimeoutMinutes === "number" &&
      (typeof hello.setName === "string" || hello.msg === "isdbgrid")
    );
  })();
  return cache.transactionSupport;
}

export async function mongoPersistenceMode(): Promise<"transactional" | "standalone"> {
  return (await mongoSupportsTransactions()) ? "transactional" : "standalone";
}

export async function withMongoTransaction<T>(
  operation: (session?: ClientSession) => Promise<T>,
): Promise<T> {
  const connection = await connectMongo();
  if (!(await mongoSupportsTransactions())) return operation(undefined);
  const session = await connection.startSession();
  let result: T | undefined;
  try {
    await session.withTransaction(
      async () => {
        result = await operation(session);
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
    if (result === undefined) throw new Error("MongoDB transaction returned no result");
    return result;
  } catch (error) {
    if ((error as { code?: number }).code === 20) {
      cache.transactionSupport = Promise.resolve(false);
      return operation(undefined);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function disconnectMongo(): Promise<void> {
  cache.connection = undefined;
  cache.indexes = undefined;
  cache.uri = undefined;
  cache.transactionSupport = undefined;
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
