import "server-only";

import type { Fixture, TxLineSnapshot } from "@/lib/domain/flash-bets";
import { snapshotFromFixture } from "@/lib/market-policy";

export function captureTxLineSnapshot(
  fixture: Fixture | null,
  capturedAt: string,
): TxLineSnapshot | null {
  return fixture ? snapshotFromFixture(fixture, capturedAt) : null;
}
