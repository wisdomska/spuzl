"use server";

import { loadLogic } from "@/games/logic-registry";
import { PRACTICE, type GuessLogic } from "@/games/_shared/guess";
import { createRng } from "@/lib/rng";
import type { Difficulty, Hint } from "@/games/types";

/**
 * Server side of the /dev/board fixture: the board's hints and content-game guesses are answered here, from the
 * same seed the page built the board with, so no game logic (or content) is bundled for the client. Refused
 * where the fixture route is hidden (production, unless dev routes are enabled), like `devOnly`. A seed only
 * rebuilds a fixture board, never a player's served puzzle (free play seeds stay on the server).
 */
async function fixture(game: string, seed: string, d: Difficulty) {
  if (process.env.VERCEL_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "1") throw new Error("dev fixture only");
  const logic = await loadLogic(game);
  return { logic, g: logic.generate(createRng(seed), d) };
}

export async function devHintAction(game: string, seed: string, d: Difficulty, state: unknown): Promise<Hint | null> {
  const { logic, g } = await fixture(game, seed, d);
  return logic.hint?.(g.puzzle, g.solution, state) ?? null;
}

/** A content game's guess on the fixture board, checked as practice (its answers are public anyway). */
export async function devGuessAction(game: string, seed: string, d: Difficulty, guess: unknown): Promise<unknown> {
  const { logic, g } = await fixture(game, seed, d);
  const l = logic as unknown as Partial<GuessLogic>;
  if (typeof l.checkGuess !== "function") throw new Error("no guess check");
  return l.checkGuess(g.puzzle, g.solution, guess, PRACTICE);
}
