import { Suspense } from "react";
import type { Metadata } from "next";
import { DuelScreen } from "@/components/multiplayer/DuelScreen";
import { LoadingScreen } from "@/components/multiplayer/ui";

export const metadata: Metadata = { title: "Duel" };

/** Duel: entry sheet, matchmaking, versus, best of 3, match end and rematch (Multiplayer D1 to D4, Overlays M1 to M3). */
export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DuelScreen />
    </Suspense>
  );
}
