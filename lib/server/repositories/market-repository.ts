import "server-only";

import type { ClientSession } from "mongoose";

import type { Market, MarketStatus } from "@/lib/domain/flash-bets";
import { connectMongo } from "@/lib/server/db/mongoose";
import { MarketModel } from "@/lib/server/db/models";
import { toDomain } from "@/lib/server/repositories/repository-utils";

export async function findMarket(
  marketId: string,
  session?: ClientSession,
): Promise<Market | null> {
  await connectMongo();
  const market = await MarketModel.findOne({ marketId }).session(session ?? null).lean();
  return market ? toDomain<Market>(market) : null;
}

export async function insertMarketIfAbsent(
  market: Market,
  session?: ClientSession,
): Promise<void> {
  await connectMongo();
  await MarketModel.updateOne(
    { marketId: market.marketId },
    { $setOnInsert: market },
    { upsert: true, session },
  );
}

export async function listMarketsForFixture(
  fixtureId: string,
  session?: ClientSession,
): Promise<Market[]> {
  await connectMongo();
  const markets = await MarketModel.find({ fixtureId })
    .sort({ startMinute: 1, type: 1 })
    .session(session ?? null)
    .lean();
  return markets.map((market) => toDomain<Market>(market));
}

export async function listDueMarkets(now: string): Promise<Market[]> {
  await connectMongo();
  const markets = await MarketModel.find({
    status: "WAITING_FOR_SETTLEMENT",
    settlesAt: { $lte: now },
  })
    .sort({ settlesAt: 1, marketId: 1 })
    .lean();
  return markets.map((market) => toDomain<Market>(market));
}

export async function listUnfinishedMarkets(): Promise<Market[]> {
  await connectMongo();
  const markets = await MarketModel.find({
    status: { $nin: ["SETTLED", "VOID"] },
  })
    .sort({ endsAt: 1, marketId: 1 })
    .lean();
  return markets.map((market) => toDomain<Market>(market));
}

export async function transitionMarket(input: {
  marketId: string;
  from: MarketStatus[];
  to: MarketStatus;
  updatedAt: string;
  openingSnapshot?: Market["openingSnapshot"];
  session?: ClientSession;
}): Promise<Market | null> {
  await connectMongo();
  const set: Record<string, unknown> = {
    status: input.to,
    updatedAt: input.updatedAt,
  };
  if (input.openingSnapshot !== undefined) set.openingSnapshot = input.openingSnapshot;
  const saved = await MarketModel.findOneAndUpdate(
    { marketId: input.marketId, status: { $in: input.from } },
    { $set: set },
    { new: true, session: input.session, lean: true },
  );
  return saved ? toDomain<Market>(saved) : null;
}

export async function finalizeMarket(input: {
  marketId: string;
  status: Extract<MarketStatus, "SETTLED" | "VOID">;
  closingSnapshot: Market["closingSnapshot"];
  result: Market["result"];
  settlementReceiptId: string;
  updatedAt: string;
  session?: ClientSession;
}): Promise<Market | null> {
  await connectMongo();
  const saved = await MarketModel.findOneAndUpdate(
    {
      marketId: input.marketId,
      $or: [
        {
          status: { $nin: ["SETTLED", "VOID"] },
          settlementReceiptId: null,
        },
        {
          status: input.status,
          settlementReceiptId: input.settlementReceiptId,
        },
      ],
    },
    {
      $set: {
        status: input.status,
        closingSnapshot: input.closingSnapshot,
        result: input.result,
        settlementReceiptId: input.settlementReceiptId,
        updatedAt: input.updatedAt,
      },
    },
    { new: true, session: input.session, lean: true },
  );
  return saved ? toDomain<Market>(saved) : null;
}

export async function upsertMarketForMigration(
  market: Market,
  session?: ClientSession,
): Promise<void> {
  await connectMongo();
  await MarketModel.updateOne(
    { marketId: market.marketId },
    { $set: market },
    { upsert: true, session },
  );
}
