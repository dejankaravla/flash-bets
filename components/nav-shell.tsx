"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { SolanaWalletProvider } from "@/components/solana-wallet-provider";
import type { FlashBetsMode } from "@/lib/app-mode";

interface NavShellProps {
  children: React.ReactNode;
  mode: FlashBetsMode;
}

export function NavShell({ children, mode }: NavShellProps) {
  const pathname = usePathname();
  const showNav = pathname !== "/";

  return (
    <>
      <SolanaWalletProvider>
        {showNav && <AppHeader mode={mode} />}
        <div className={showNav ? "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0" : undefined}>{children}</div>
        {showNav && <BottomNav />}
      </SolanaWalletProvider>
    </>
  );
}
