import { Suspense } from "react";
import type { Metadata } from "next";
import { PartyRoom } from "@/components/multiplayer/PartyScreen";
import { LoadingScreen } from "@/components/multiplayer/ui";

export const metadata: Metadata = { title: "Party room" };

/** Party room: lobby, live race, podium; ?view=tv for TV and classroom mode (Multiplayer P1 to P3, T1). */
export default async function Page({ params }: PageProps<"/party/[code]">) {
  const { code } = await params;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PartyRoom code={code} />
    </Suspense>
  );
}
