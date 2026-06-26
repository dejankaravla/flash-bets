"use client";

import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

import idl from "@/lib/idl/txoracle-devnet.json";

export function useAnchorProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(idl as Idl, provider);
  }, [provider]);

  return {
    program,
    provider,
    ready: !!program && !!wallet?.publicKey,
    publicKey: wallet?.publicKey ?? null,
  };
}
