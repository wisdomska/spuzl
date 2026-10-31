import type { Metadata } from "next";
import { ChallengeScreen } from "@/components/multiplayer/ChallengeScreen";

export const metadata: Metadata = { title: "Challenge" };

/** Async challenge: card, same puzzle with the sender's ghost timer, head-to-head result (Overlays A1, A2). */
export default async function Page({ params }: PageProps<"/challenge/[code]">) {
  const { code } = await params;
  return <ChallengeScreen code={code} />;
}
