import { Suspense } from "react";
import type { Metadata } from "next";
import { GhostScreen } from "@/components/multiplayer/GhostScreen";
import { LoadingScreen } from "@/components/multiplayer/ui";
import { notFound } from "next/navigation";
import { playableGame } from "@/lib/catalog";

export const metadata: Metadata = { title: "Ghost Race" };

/** Ghost Race: today's Rage Ridge track against a friend's replay (Overlays GR). ?run=<id> races a shared run. */
export default async function Page({ params }: PageProps<"/ghost/[game]">) {
  const { game } = await params;
  // Retired tracks (Flipside, Ghosted) and unknown games are not found; the API refuses them too.
  if (!playableGame(game)) notFound();
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GhostScreen game={game} />
    </Suspense>
  );
}
