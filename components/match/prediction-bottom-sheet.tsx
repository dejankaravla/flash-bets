"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { useState } from "react";

import { formatWindowLabel, type MicroMarket } from "@/lib/micro-markets";
import { useAnchorProgram } from "@/lib/hooks/use-anchor-program";
import { MIN_DEPOSIT_TOKENS, TOKEN_SCALE } from "@/lib/txoracle/constants";
import {
  formatTxError,
  submitCreateIntent,
} from "@/lib/txoracle/create-intent";
import { truncateAddress } from "@/lib/wallet";

type TxPhase =
  | "idle"
  | "building"
  | "awaiting_wallet"
  | "confirming"
  | "success"
  | "error";

interface PredictionBottomSheetProps {
  fixtureId: string;
  market: MicroMarket;
  gameState: number;
  estimatedMatchSeconds: number;
  matchLabel?: string;
  onClose: () => void;
  onConfirm: (selection: "yes" | "no", amount: number, txSignature?: string) => void;
}

export function PredictionBottomSheet({
  fixtureId,
  market,
  gameState,
  estimatedMatchSeconds,
  matchLabel,
  onClose,
  onConfirm,
}: PredictionBottomSheetProps) {
  const { connection } = useConnection();
  const { program, ready, publicKey } = useAnchorProgram();
  const [selection, setSelection] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("10");
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [walletError, setWalletError] = useState<string | null>(null);

  const isBusy = phase !== "idle" && phase !== "error";

  const handleConfirm = async () => {
    if (isBusy) return;

    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) return;

    const depositRaw = Math.floor(parsed * TOKEN_SCALE);
    if (depositRaw < MIN_DEPOSIT_TOKENS) {
      setWalletError("Minimum deposit is 1 TxL");
      return;
    }

    if (!ready || !publicKey || !program) {
      setWalletError("Connect your wallet to place a prediction");
      return;
    }

    setWalletError(null);
    setPhase("building");

    try {
      setPhase("awaiting_wallet");
      const { signature } = await submitCreateIntent({
        program,
        maker: publicKey,
        connection,
        fixtureId: Number(fixtureId),
        market,
        gameState,
        selection,
        amountTxl: parsed,
        estimatedMatchSeconds,
        matchLabel,
      });

      setPhase("confirming");
      setPhase("success");
      onConfirm(selection, parsed, signature);
      onClose();
    } catch (error) {
      setPhase("error");
      setWalletError(formatTxError(error));
    } finally {
      setPhase("idle");
    }
  };

  const buttonLabel = (() => {
    switch (phase) {
      case "building":
        return "Building transaction…";
      case "awaiting_wallet":
        return "Approve in wallet…";
      case "confirming":
        return "Confirming on-chain…";
      default:
        return "Confirm Prediction (TxL)";
    }
  })();

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-md rounded-t-3xl border border-zinc-800 bg-zinc-900 px-5 pb-8 pt-4 shadow-2xl transition-transform duration-300"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-700" />

        <h2 className="text-lg font-semibold text-zinc-50">Place Prediction</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {formatWindowLabel(market.windowStart, market.windowEnd)} ·{" "}
          {market.proposition}
        </p>
        {publicKey && (
          <p className="mt-1 font-mono text-xs text-zinc-600">
            {truncateAddress(publicKey.toBase58())}
          </p>
        )}

        {walletError && (
          <p className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">
            {walletError}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelection("yes")}
            disabled={isBusy}
            className={`rounded-xl py-4 text-base font-bold transition-colors ${
              selection === "yes"
                ? "bg-emerald-500 text-white"
                : "border border-zinc-700 bg-zinc-800 text-zinc-300"
            }`}
          >
            YES
          </button>
          <button
            type="button"
            onClick={() => setSelection("no")}
            disabled={isBusy}
            className={`rounded-xl py-4 text-base font-bold transition-colors ${
              selection === "no"
                ? "bg-red-500 text-white"
                : "border border-zinc-700 bg-zinc-800 text-zinc-300"
            }`}
          >
            NO
          </button>
        </div>

        <label className="mt-6 block">
          <span className="text-sm font-medium text-zinc-400">TxL Amount</span>
          <input
            type="number"
            min={1}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isBusy}
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-lg font-mono text-zinc-50 outline-none focus:border-emerald-500 disabled:opacity-50"
          />
        </label>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isBusy}
          className="mt-6 w-full rounded-xl bg-emerald-500 py-4 text-base font-bold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
