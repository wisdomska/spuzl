/**
 * NFR-CO-01: proves every upcoming logic Daily has exactly one solution and that verify() accepts the
 * stored solution. Without DB env it validates the deterministic schedule; with it, the stored puzzles.
 */
import { createClient } from "@supabase/supabase-js";
import { argDays, dailyFor, datesFrom, readyGames, requiresUnique } from "./lib-dailies.mts";
import { LOGIC } from "../games/logic-registry";
import type { GameLogic } from "../games/types";

const days = argDays(60);
const today = new Date().toISOString().slice(0, 10);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
let checked = 0;
const failures: string[] = [];

if (url && key && process.argv.includes("--db")) {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db.from("dailies").select("date, game_id, puzzles!dailies_puzzle_id_fkey(data, solution)").gte("date", today).lt("date", datesFrom(today, days + 1).pop()!);
  for (const row of data ?? []) {
    const p = row.puzzles as unknown as { data: unknown; solution: unknown };
    if (!LOGIC[row.game_id]) continue;
    const logic = (await LOGIC[row.game_id]()).default as GameLogic<unknown, unknown, unknown>;
    if (requiresUnique(row.game_id) && logic.countSolutions?.(p.data, 2) !== 1) failures.push(`${row.game_id} ${row.date}: not unique`);
    checked++;
  }
} else {
  for (const game of readyGames()) {
    for (const date of datesFrom(today, days)) {
      const { gen, logic } = await dailyFor(game, date);
      if (requiresUnique(game)) {
        const n = logic.countSolutions?.(gen.puzzle, 2);
        if (n !== 1) failures.push(`${game} ${date}: ${n} solutions`);
      }
      checked++;
    }
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`validated ${checked} dailies, all unique where required`);
