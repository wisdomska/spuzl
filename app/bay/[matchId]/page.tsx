import { Suspense } from "react";
import type { Metadata } from "next";
import { BayMatch } from "@/components/multiplayer/bay/BayScreen";
import { LoadingScreen } from "@/components/multiplayer/ui";

export const metadata: Metadata = { title: "Board Bay" };

/** Board Bay match, live (clocks) or async (24 h per move): the shared board (Board Games B3). ?join=<code> accepts an invite. */
export default async function Page({ params }: PageProps<"/bay/[matchId]">) {
  const { matchId } = await params;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BayMatch id={matchId} />
    </Suspense>
  );
}
