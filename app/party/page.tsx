import type { Metadata } from "next";
import { PartyHome } from "@/components/multiplayer/PartyScreen";

export const metadata: Metadata = { title: "Party" };

/** Party Race: create a room or join one by code (Overlays P0). */
export default function Page() {
  return <PartyHome />;
}
