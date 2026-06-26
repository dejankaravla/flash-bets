import type { MockBet } from "@/lib/mock-bets";
import { truncateAddress } from "@/lib/wallet";
import { BET_DISPLAY_CACHE_KEY } from "@/lib/txoracle/constants";
import { termsHashPrefix } from "@/lib/txoracle/terms-hash";

export interface BetDisplayCache {
  matchLabel?: string;
  proposition: string;
  windowLabel: string;
  selection: "YES" | "NO";
}

type CacheStore = Record<string, BetDisplayCache>;

export function readBetDisplayCache(pda: string): BetDisplayCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(BET_DISPLAY_CACHE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw) as CacheStore;
    return store[pda] ?? null;
  } catch {
    return null;
  }
}

export function writeBetDisplayCache(
  pda: string,
  cache: BetDisplayCache,
): void {
  if (typeof window === "undefined") return;

  try {
    const raw = localStorage.getItem(BET_DISPLAY_CACHE_KEY);
    const store: CacheStore = raw ? (JSON.parse(raw) as CacheStore) : {};
    store[pda] = cache;
    localStorage.setItem(BET_DISPLAY_CACHE_KEY, JSON.stringify(store));
  } catch {
    // Incognito / quota — do not block tx success
  }
}

interface OrderIntentLike {
  maker: { toBase58: () => string };
  intentId: { toString: () => string };
  depositAmount: { toNumber: () => number };
  termsHash: number[];
  fixtureId: { toNumber: () => number };
  state: Record<string, unknown>;
}

interface MatchedTradeLike {
  tradeId: { toString: () => string };
  maker: { toBase58: () => string };
  taker: { toBase58: () => string };
  stakeMaker: { toNumber: () => number };
  stakeTaker: { toNumber: () => number };
  termsHash: number[];
  state: Record<string, unknown>;
}

function intentStateKey(state: Record<string, unknown>): string {
  return Object.keys(state)[0] ?? "active";
}

function mapIntentState(
  state: Record<string, unknown>,
): Pick<MockBet, "status" | "activePhase"> {
  const key = intentStateKey(state).toLowerCase();

  if (key === "active") {
    return { status: "active", activePhase: "open" };
  }
  if (key === "locked") {
    return { status: "active", activePhase: "in_progress" };
  }
  return { status: "settled" };
}

export function mapOrderIntentToBet(
  publicKey: string,
  account: OrderIntentLike,
  cache?: BetDisplayCache | null,
): MockBet {
  const fixtureId = account.fixtureId.toNumber();
  const id = `${publicKey}`;
  const hashPrefix = termsHashPrefix(account.termsHash);
  const stateMapping = mapIntentState(account.state);

  return {
    id,
    accountAddress: publicKey,
    fixtureId,
    matchLabel: cache?.matchLabel ?? `Match #${fixtureId}`,
    proposition: cache?.proposition ?? `Intent ${hashPrefix}…`,
    windowLabel: cache?.windowLabel ?? "—",
    selection: cache?.selection,
    amountUsdc: account.depositAmount.toNumber() / 1_000_000,
    isFallbackDisplay: !cache,
    ...stateMapping,
  };
}

export function mapMatchedTradeToBet(
  publicKey: string,
  account: MatchedTradeLike,
  walletAddress: string,
  cache?: BetDisplayCache | null,
): MockBet {
  const isMaker = account.maker.toBase58() === walletAddress;
  const stake = isMaker
    ? account.stakeMaker.toNumber()
    : account.stakeTaker.toNumber();
  const hashPrefix = termsHashPrefix(account.termsHash);
  const stateKey = intentStateKey(account.state).toLowerCase();
  const isResolved = stateKey === "resolved";

  return {
    id: `trade-${account.tradeId.toString()}`,
    accountAddress: truncateAddress(publicKey),
    matchLabel: cache?.matchLabel ?? "Matched trade",
    proposition: cache?.proposition ?? `Trade ${hashPrefix}…`,
    windowLabel: cache?.windowLabel ?? "—",
    selection: cache?.selection,
    amountUsdc: stake / 1_000_000,
    status: isResolved ? "settled" : "active",
    isFallbackDisplay: !cache,
  };
}
