import { Suspense } from "react";
import type { Metadata } from "next";
import { PartyHome } from "@/components/multiplayer/PartyScreen";
import { LoadingScreen } from "@/components/multiplayer/ui";

export const metadata: Metadata = { title: "Party" };

/** Party Race: create a room or join one by code (Overlays P0). `?crew=<id>` labels the room for a crew. */
export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PartyHome />
    </Suspense>
  );
}
