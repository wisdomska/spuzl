import { Suspense } from "react";
import type { Metadata } from "next";
import { BayInbox } from "@/components/multiplayer/bay/BayScreen";
import { LoadingScreen } from "@/components/multiplayer/ui";

export const metadata: Metadata = { title: "Your move" };

/**
 * Board Bay "Your move" inbox and new games (Board Games B7). ?live=<game> opens Play live (matchmaking) for
 * that game; ?new=<game> opens the new-game sheet on that game (Challenge a friend).
 */
export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BayInbox />
    </Suspense>
  );
}
