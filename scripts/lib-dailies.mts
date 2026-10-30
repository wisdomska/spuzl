/** Shared by generate-puzzles and validate-dailies: the deterministic Daily for (game, date). */
import { GAME_BY_ID } from "../lib/catalog";
import { LOGIC } from "../games/logic-registry";
import { createRng } from "../lib/rng";
import { difficultyForDate, type ContentLogic, type GameLogic, type Generated } from "../games/types";
import { dailyNumber } from "../lib/format";

export const readyGames = () => Object.keys(LOGIC);

export async function dailyFor(gameId: string, date: string): Promise<{ seed: string; difficulty: ReturnType<typeof difficultyForDate>; gen: Generated<unknown, unknown>; logic: GameLogic<unknown, unknown, unknown> }> {
  const logic = (await LOGIC[gameId]()).default as GameLogic<unknown, unknown, unknown>;
  const difficulty = difficultyForDate(date);
  const seed = `daily:${gameId}:${date}`;
  const content = logic as Partial<ContentLogic<unknown, unknown, unknown>>;
  const gen = typeof content.generateAt === "function" ? content.generateAt(dailyNumber(date), difficulty) : logic.generate(createRng(seed), difficulty);
  return { seed, difficulty, gen, logic };
}

export function datesFrom(start: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => new Date(Date.parse(start + "T00:00:00Z") + i * 86_400_000).toISOString().slice(0, 10));
}

export function requiresUnique(gameId: string) {
  return GAME_BY_ID[gameId]?.unique ?? false;
}

export function argDays(def: number) {
  const i = process.argv.indexOf("--days");
  return i > 0 ? Number(process.argv[i + 1]) : def;
}
