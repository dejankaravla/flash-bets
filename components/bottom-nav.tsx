"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  id: string;
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
  icon: ReactNode;
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );
}

function LiveMatchIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
    >
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <path strokeLinecap="round" d="M12 7v5l3 2" />
    </svg>
  );
}

function MyBetsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/",
    isActive: (p) => p === "/",
    icon: <DashboardIcon active={false} />,
  },
  {
    id: "matches",
    label: "Matches",
    href: "/dashboard",
    isActive: (p) => p === "/dashboard" || p.startsWith("/match/"),
    icon: <LiveMatchIcon active={false} />,
  },
  {
    id: "my-predictions",
    label: "My Predictions",
    href: "/my-predictions",
    isActive: (p) => p === "/my-predictions" || p === "/my-bets",
    icon: <MyBetsIcon active={false} />,
  },
];

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  switch (item.label) {
    case "Overview":
      return <DashboardIcon active={active} />;
    case "Matches":
      return <LiveMatchIcon active={active} />;
    case "My Predictions":
      return <MyBetsIcon active={active} />;
    default:
      return item.icon;
  }
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile navigation"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-2 pb-2">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 text-xs font-medium transition-colors ${
                active ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <NavIcon item={item} active={active} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
