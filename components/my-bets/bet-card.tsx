"use client";

import { useState } from "react";
import type { MockBet } from "@/lib/mock-bets";
import { TxLineProofDrawer } from "@/components/my-bets/txline-proof-drawer";
import { truncateAddress } from "@/lib/wallet";

interface BetCardProps {
  bet: MockBet;
}

export function BetCard({ bet }: BetCardProps) {
  const [proofOpen, setProofOpen] = useState(false);

  const matchLabel =
    bet.matchLabel || (bet.fixtureId != null ? `Match #${bet.fixtureId}` : "Match");
  const proposition = bet.proposition || "On-chain intent";
  const windowLabel = bet.windowLabel || "—";
  const hasSelection = bet.selection === "YES" || bet.selection === "NO";

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">{matchLabel}</p>
          <p className="mt-1 font-semibold text-zinc-100">{proposition}</p>
          <p className="mt-0.5 text-sm text-zinc-400">{windowLabel}</p>
          {bet.isFallbackDisplay && bet.accountAddress && (
            <p className="mt-1 font-mono text-xs text-zinc-600">
              {truncateAddress(bet.accountAddress, 6)}
            </p>
          )}
        </div>
        {bet.status === "active" && bet.activePhase && (
          <span
            className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold uppercase ${
              bet.activePhase === "in_progress"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-emerald-500/15 text-emerald-400"
            }`}
          >
            {bet.activePhase === "in_progress" ? "IN-PROGRESS" : "OPEN"}
          </span>
        )}
        {bet.status === "settled" && bet.outcome && (
          <span
            className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold uppercase ${
              bet.outcome === "win"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {bet.outcome}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        {hasSelection ? (
          <span
            className={`font-bold ${
              bet.selection === "YES" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {bet.selection}
          </span>
        ) : (
          <span className="text-zinc-500">—</span>
        )}
        <span className="font-mono text-zinc-300">
          {bet.amountUsdc.toFixed(2)} TxL
        </span>
      </div>

      {bet.status === "settled" && bet.txlineProof && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setProofOpen((v) => !v)}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            Verified via TxLINE
          </button>
          <TxLineProofDrawer proof={bet.txlineProof} open={proofOpen} />
        </div>
      )}
    </article>
  );
}
