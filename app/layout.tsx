import type { Metadata, Viewport } from "next";
import { NavShell } from "@/components/nav-shell";
import { ModeBanner } from "@/components/mode-banner";
import { flashBetsMode } from "@/lib/app-mode";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlashBets",
  description: "Live football micro-predictions using non-transferable FlashPoints",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const mode = flashBetsMode();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50">
        <ModeBanner mode={mode} />
        <NavShell mode={mode}>{children}</NavShell>
      </body>
    </html>
  );
}
