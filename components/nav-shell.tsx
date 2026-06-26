"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { SolanaWalletProvider } from "@/components/solana-wallet-provider";

interface NavShellProps {
  children: React.ReactNode;
}

export function NavShell({ children }: NavShellProps) {
  const pathname = usePathname();
  const showNav = pathname !== "/";

  return (
    <>
      <SolanaWalletProvider>
        <div className={showNav ? "pb-20" : undefined}>{children}</div>
      </SolanaWalletProvider>
      {showNav && <BottomNav />}
    </>
  );
}
