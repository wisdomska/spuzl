import { devOnly } from "@/lib/dev/guard";
import { DevDuel } from "./DevDuel";

/**
 * Fixture route for the Duel result screens without a live match: /dev/duel?screen=round|end&won=1&long=1.
 * `long` gives the rival a long nickname and the worst-case end card (head to head, add friend, rematch note).
 */
export default async function Page({ searchParams }: PageProps<"/dev/duel">) {
  devOnly();
  const sp = await searchParams;
  return <DevDuel screen={sp.screen === "end" ? "end" : "round"} won={sp.won !== "0"} long={sp.long === "1"} />;
}
