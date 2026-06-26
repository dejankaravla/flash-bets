"use client";

import type { TxLineProofReceipt } from "@/lib/mock-bets";

interface TxLineProofDrawerProps {
  proof: TxLineProofReceipt;
  open: boolean;
}

export function TxLineProofDrawer({ proof, open }: TxLineProofDrawerProps) {
  if (!open) return null;

  return (
    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-zinc-950 p-4">
      <dl className="space-y-3 font-mono text-xs">
        <div>
          <dt className="text-zinc-500">Merkle Root</dt>
          <dd className="mt-0.5 break-all text-emerald-400">{proof.merkleRoot}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Sequence</dt>
          <dd className="mt-0.5 text-zinc-200">{proof.seq}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Fixture ID</dt>
          <dd className="mt-0.5 text-zinc-200">{proof.fixtureId}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Stat Primitive</dt>
          <dd className="mt-0.5 text-zinc-200">
            key {proof.statKey} → {proof.statLabel} = {proof.verifiedValue}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Batch Interval</dt>
          <dd className="mt-0.5 text-zinc-200">{proof.batchInterval}</dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
        Cryptographically anchored on Solana
      </p>
    </div>
  );
}
