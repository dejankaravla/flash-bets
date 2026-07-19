import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/landing-hero";
import { flashBetsMode } from "@/lib/app-mode";

export const metadata: Metadata = {
  title: "FlashBets · Five-minute football predictions",
  description: "Connect a wallet, receive demo FlashPoints, predict Goal or Corner, and review automatic settlement receipts.",
};

export default function Home() {
  return <LandingHero mode={flashBetsMode()} />;
}
