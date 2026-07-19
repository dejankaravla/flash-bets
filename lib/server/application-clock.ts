import "server-only";

type Clock = () => number;

const globalClock = globalThis as typeof globalThis & {
  __flashBetsBusinessClock?: Clock;
};

export function applicationNowMs(): number {
  return globalClock.__flashBetsBusinessClock?.() ?? Date.now();
}

export function registerApplicationClock(clock: Clock): void {
  globalClock.__flashBetsBusinessClock = clock;
}
