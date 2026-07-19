"use client";

import bs58 from "bs58";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import type { AuthenticatedUserView } from "@/lib/domain/flash-bets";
import { readApiError } from "@/lib/client-errors";

interface WalletAuthContextValue {
  user: AuthenticatedUserView | null;
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const WalletAuthContext = createContext<WalletAuthContextValue | null>(null);

export function WalletAuthProvider({ children }: { children: ReactNode }) {
  const { connected, publicKey, signMessage } = useWallet();
  const [serverUser, setServerUser] = useState<AuthenticatedUserView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) throw new Error(await readApiError(response, "FlashBets sign-in is temporarily unavailable."));
      const payload = (await response.json()) as {
        authenticated: boolean;
        user: AuthenticatedUserView | null;
      };
      setServerUser(payload.authenticated ? payload.user : null);
      setError(null);
    } catch (reason) {
      setServerUser(null);
      setError(reason instanceof Error ? reason.message : "Session service unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    return () => { active = false; };
  }, [refresh]);

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!connected || !publicKey) {
      setError("Connect a Solana wallet first");
      return false;
    }
    if (!signMessage) {
      setError("This wallet cannot sign authentication messages");
      return false;
    }

    const wallet = publicKey.toBase58();
    setLoading(true);
    setError(null);
    try {
      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      if (!challengeResponse.ok) throw new Error(await readApiError(challengeResponse, "FlashBets could not start wallet sign-in. Try again."));
      const challenge = (await challengeResponse.json()) as {
        challengeId: string;
        message: string;
      };
      const signed = await signMessage(new TextEncoder().encode(challenge.message));
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          wallet,
          signature: bs58.encode(signed),
        }),
      });
      if (!verifyResponse.ok) throw new Error(await readApiError(verifyResponse, "FlashBets could not verify the wallet signature. Try again."));
      const verified = (await verifyResponse.json()) as {
        authenticated: true;
        user: AuthenticatedUserView;
      };
      setServerUser(verified.user);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wallet sign-in failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, signMessage]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(await readApiError(response, "Sign-out did not complete. Try again."));
      setServerUser(null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-out did not complete. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const wallet = publicKey?.toBase58() ?? null;
  const authenticated = Boolean(connected && wallet && serverUser?.wallet === wallet);
  const user = authenticated ? serverUser : null;
  const value = useMemo(
    () => ({ user, authenticated, loading, error, signIn, signOut, refresh }),
    [user, authenticated, loading, error, signIn, signOut, refresh],
  );

  return <WalletAuthContext.Provider value={value}>{children}</WalletAuthContext.Provider>;
}

export function useWalletAuth(): WalletAuthContextValue {
  const value = useContext(WalletAuthContext);
  if (!value) throw new Error("useWalletAuth must be used inside WalletAuthProvider");
  return value;
}
