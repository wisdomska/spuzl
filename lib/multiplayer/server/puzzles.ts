import "server-only";
import { loadLogic } from "@/games/logic-registry";
import type { Difficulty, GameLogic } from "@/games/types";
import { createRng } from "@/lib/rng";
import { roundSeed } from "../games";

interface Round {
  logic: GameLogic<unknown, unknown, unknown>;
  puzzle: unknown;
  solution: unknown;
}

/** Generated round puzzles, keyed by seed. Generation is deterministic, so a miss just regenerates. */
const cache = new Map<string, Round>();
const MAX = 300;

/** The shared puzzle for one round of a match. Same seed, same puzzle for every player. */
export async function roundPuzzle(matchId: string, setNo: number, round: number, game: string, difficulty: string): Promise<Round> {
  const seed = roundSeed(matchId, setNo, round);
  const key = `${seed}|${game}|${difficulty}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const logic = await loadLogic(game);
  const g = logic.generate(createRng(seed), difficulty as Difficulty);
  const r = { logic, puzzle: g.puzzle, solution: g.solution };
  cache.set(key, r);
  if (cache.size > MAX) cache.delete(cache.keys().next().value!);
  return r;
}
