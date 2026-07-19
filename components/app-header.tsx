"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { FlashBetsMode } from "@/lib/app-mode";
import { WalletAddressBadge } from "@/components/wallet-address-badge";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Matches",
    active: (path: string) => path === "/dashboard" || path.startsWith("/match/"),
  },
  {
    href: "/my-predictions",
    label: "My Predictions",
    active: (path: string) => path === "/my-predictions" || path === "/my-bets",
  },
] as const;

export function AppHeader({ mode }: { mode: FlashBetsMode }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/95">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-lg text-zinc-50"
          aria-label="FlashBets matches"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 text-sm font-black text-zinc-950 shadow-lg shadow-emerald-500/20">
            FB
          </span>
          <span className="hidden text-sm font-bold tracking-tight sm:inline">FlashBets</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const active = item.active(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-zinc-800 text-zinc-50"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <span
            className={`hidden rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider sm:inline-flex ${
              mode === "REPLAY"
                ? "border-violet-400/30 bg-violet-500/10 text-violet-200"
                : "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {mode === "REPLAY" ? "Replay demo" : "Live mode"}
          </span>
          <WalletAddressBadge />
        </div>
      </div>
    </header>
  );
}
