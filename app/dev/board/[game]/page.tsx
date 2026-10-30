import { notFound } from "next/navigation";
import { devOnly } from "@/lib/dev/guard";
import { GAME_BY_ID } from "@/lib/catalog";
import { loadLogic, hasLogic } from "@/games/logic-registry";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { DevBoard } from "./DevBoard";

/** Fixture route for visual parity and E2E: /dev/board/crownfall?seed=x&d=easy&state=... */
export default async function Page({ params, searchParams }: PageProps<"/dev/board/[game]">) {
  devOnly();
  const { game } = await params;
  const sp = await searchParams;
  const meta = GAME_BY_ID[game];
  if (!meta || !hasLogic(game)) notFound();
  const logic = await loadLogic(game);
  const seed = typeof sp.seed === "string" ? sp.seed : "dev";
  const d = (typeof sp.d === "string" ? sp.d : "easy") as Difficulty;
  const g = logic.generate(createRng(seed), d);
  return <DevBoard id={game} puzzle={g.puzzle} solution={g.solution} />;
}
