import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_BY_ID } from "@/lib/catalog";
import { LOGIC } from "@/games/logic-registry";
import { createRng } from "@/lib/rng";
import { difficultyForDate, type ContentLogic, type GameLogic } from "@/games/types";
import { dailyNumber, dailySeed } from "@/lib/format";
import { encodeSolution } from "./solution-codec";

/**
 * Keeps the Daily buffer full: fills every missing (date, game) up to `days` ahead, oldest gap first,
 * and stops when the time budget runs out (the next run continues). Logic Dailies are proven unique.
 */
export async function fillSchedule(db: SupabaseClient, { days = 60, budgetMs = 45_000 } = {}) {
  const started = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const dates = Array.from({ length: days }, (_, i) =>
    new Date(Date.parse(today + "T00:00:00Z") + i * 86_400_000).toISOString().slice(0, 10),
  );
  const { data } = await db.from("dailies").select("date, game_id").gte("date", today);
  const have = new Set((data ?? []).map((r) => `${r.date}|${r.game_id}`));
  let made = 0;
  let pending = 0;
  for (const date of dates) {
    for (const game of Object.keys(LOGIC)) {
      if (have.has(`${date}|${game}`)) continue;
      if (Date.now() - started > budgetMs) {
        pending++;
        continue;
      }
      const logic = (await LOGIC[game]()).default as GameLogic<unknown, unknown, unknown> &
        Partial<ContentLogic<unknown, unknown, unknown>>;
      const difficulty = game === "gauntlet" ? "hard" : difficultyForDate(date);
      const seed = dailySeed(game, date);
      const gen =
        typeof logic.generateAt === "function"
          ? logic.generateAt(dailyNumber(date), difficulty)
          : logic.generate(createRng(seed), difficulty);
      if (GAME_BY_ID[game]?.unique && logic.countSolutions && logic.countSolutions(gen.puzzle, 2) !== 1)
        throw new Error(`${game} ${date}: not unique`);
      const { data: pz, error } = await db
        .from("puzzles")
        .upsert(
          {
            game_id: game,
            seed,
            difficulty,
            grade: gen.grade,
            data: gen.puzzle,
            solution: encodeSolution(gen.solution),
            solution_hash: createHash("sha256")
              .update(JSON.stringify(gen.solution ?? null))
              .digest("hex"),
            status: "scheduled",
          },
          { onConflict: "game_id,seed,difficulty" },
        )
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await db.from("dailies").insert({ date, game_id: game, puzzle_id: pz.id, locked: dates.indexOf(date) < 7 });
      if (e2 && e2.code !== "23505") throw e2;
      made++;
    }
  }
  return { made, pending, through: dates[dates.length - 1] };
}
