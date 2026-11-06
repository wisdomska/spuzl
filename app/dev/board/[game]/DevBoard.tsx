"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GameShell } from "@/components/game/GameShell";
import { BOARDS } from "@/games/board-registry";
import { GAME_BY_ID } from "@/lib/catalog";
import { setGuessTransport } from "@/games/_shared/guess";
import type { Difficulty } from "@/games/types";
import { devGuessAction, devHintAction } from "./actions";

/** The fixture board. Hints and content-game guesses go to the server actions, which rebuild it from the seed. */
export function DevBoard({
  id,
  puzzle,
  seed,
  d,
  mode = "free",
}: {
  id: string;
  puzzle: unknown;
  seed: string;
  d: Difficulty;
  mode?: "free" | "tutorial";
}) {
  const router = useRouter();
  useEffect(() => {
    setGuessTransport((_ref, guess) => devGuessAction(id, seed, d, guess));
    return () => setGuessTransport(null);
  }, [id, seed, d]);
  return (
    <GameShell
      meta={GAME_BY_ID[id]}
      Board={BOARDS[id]}
      puzzle={puzzle}
      mode={mode}
      guided={mode === "tutorial"}
      hintsLeft={mode === "tutorial" ? 99 : undefined}
      label="Dev fixture"
      requestHint={(state) => devHintAction(id, seed, d, state)}
      onSolved={() => {}}
      onExit={() => router.back()}
    />
  );
}
