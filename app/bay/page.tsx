import type { Metadata } from "next";
import { BayInbox } from "@/components/multiplayer/bay/BayScreen";

export const metadata: Metadata = { title: "Your move" };

/** Board Bay "Your move" inbox and new games (Board Games B7). */
export default function Page() {
  return <BayInbox />;
}
