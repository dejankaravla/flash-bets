import "server-only";

import { createHash } from "node:crypto";
import type { ClientSession } from "mongoose";

import type { SettlementReceipt } from "@/lib/domain/flash-bets";
import {
  createReceipt,
  findReceiptByMarket,
} from "@/lib/server/repositories/receipt-repository";

export const SETTLEMENT_VERSION = 1;

export function canonicalReceiptId(marketId: string): string {
  return `settlement:${createHash("sha256").update(marketId).digest("hex").slice(0, 32)}`;
}

export function persistSettlementReceipt(
  receipt: SettlementReceipt,
  session?: ClientSession,
): Promise<SettlementReceipt> {
  return createReceipt(receipt, session);
}

export function readReceiptForMarket(
  marketId: string,
  session?: ClientSession,
): Promise<SettlementReceipt | null> {
  return findReceiptByMarket(marketId, session);
}
