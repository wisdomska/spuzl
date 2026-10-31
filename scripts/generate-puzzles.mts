/**
 * Fills the Daily schedule N days ahead for every game with logic (default 60).
 * Logic Dailies are proven unique before insert. Existing dates are never overwritten (admin swaps do that).
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { encodeSolution } from "../lib/game/solution-codec.ts";
import { argDays, dailyFor, datesFrom, readyGames, requiresUnique } from "./lib-dailies.mts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const db = createClient(url, key, { auth: { persistSession: false } });

const days = argDays(60);
const today = new Date().toISOString().slice(0, 10);
const dates = datesFrom(today, days);
let made = 0;

for (const game of readyGames()) {
  const { data: have } = await db.from("dailies").select("date").eq("game_id", game).gte("date", today);
  const existing = new Set((have ?? []).map((r) => r.date));
  for (const date of dates) {
    if (existing.has(date)) continue;
    const { seed, difficulty, gen, logic } = await dailyFor(game, date);
    if (requiresUnique(game)) {
      const n = logic.countSolutions?.(gen.puzzle, 2);
      if (n !== 1) throw new Error(`${game} ${date}: ${n} solutions`);
    }
    const hash = createHash("sha256").update(JSON.stringify(gen.solution)).digest("hex");
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
          solution_hash: hash,
          status: "scheduled",
        },
        { onConflict: "game_id,seed,difficulty" },
      )
      .select("id")
      .single();
    if (error) throw error;
    const { error: e2 } = await db
      .from("dailies")
      .insert({ date, game_id: game, puzzle_id: pz.id, locked: Date.parse(date) - Date.parse(today) < 7 * 86_400_000 });
    if (e2 && e2.code !== "23505") throw e2;
    made++;
  }
  console.log(`${game}: schedule filled to ${dates[dates.length - 1]}`);
}
await db.from("audit_log").insert({ action: "script.generate_puzzles", detail: { days, made } });
console.log(`generated ${made} dailies`);
