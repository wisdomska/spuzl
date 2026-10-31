import { Suspense } from "react";
import type { Metadata } from "next";
import { GhostScreen } from "@/components/multiplayer/GhostScreen";
import { LoadingScreen } from "@/components/multiplayer/ui";

export const metadata: Metadata = { title: "Ghost Race" };

/** Ghost Race: today's Rage Ridge track against a friend's replay (Overlays GR). ?run=<id> races a shared run. */
export default async function Page({ params }: PageProps<"/ghost/[game]">) {
  const { game } = await params;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GhostScreen game={game} />
    </Suspense>
  );
}
