import "server-only";

export interface WalletActivity {
  type: "prediction" | "settlement";
  id: string;
  occurredAt: string;
}

type Listener = (activity: WalletActivity) => void;

const globalActivity = globalThis as typeof globalThis & {
  __flashBetsActivityListeners?: Map<string, Set<Listener>>;
};

const listeners = (globalActivity.__flashBetsActivityListeners ??= new Map());

export function publishWalletActivity(wallet: string, activity: WalletActivity): void {
  for (const listener of listeners.get(wallet) ?? []) listener(activity);
}

export function subscribeWalletActivity(wallet: string, listener: Listener): () => void {
  const set = listeners.get(wallet) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(wallet, set);
  return () => {
    const current = listeners.get(wallet);
    current?.delete(listener);
    if (current?.size === 0) listeners.delete(wallet);
  };
}

