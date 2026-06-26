export interface TxLineProofReceipt {
  merkleRoot: string;
  seq: number;
  fixtureId: number;
  statKey: number;
  statLabel: string;
  verifiedValue: number;
  batchInterval: string;
}

export interface MockBet {
  id: string;
  matchLabel: string;
  proposition: string;
  windowLabel: string;
  selection?: "YES" | "NO";
  amountUsdc: number;
  status: "active" | "settled";
  activePhase?: "open" | "in_progress";
  outcome?: "win" | "loss";
  txlineProof?: TxLineProofReceipt;
  fixtureId?: number;
  accountAddress?: string;
  isFallbackDisplay?: boolean;
}
