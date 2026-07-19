import type { Metadata } from "next";
import { LiveMatchArena } from "@/components/match/live-match-arena";
import { flashBetsMode } from "@/lib/app-mode";

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Match markets · FlashBets",
  description: "Follow the match and choose a five-minute Goal or Corner prediction.",
};

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-zinc-950">
      <LiveMatchArena key={id} fixtureId={id} mode={flashBetsMode()} />
    </div>
  );
}
