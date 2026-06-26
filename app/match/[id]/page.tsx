import { LiveMatchArena } from "@/components/match/live-match-arena";

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-zinc-950">
      <LiveMatchArena key={id} fixtureId={id} />
    </div>
  );
}
