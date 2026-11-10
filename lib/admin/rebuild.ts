import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dailySeed } from "@/lib/format";
import { buildDailyPuzzle, storeDailyPuzzle } from "@/lib/game/schedule";
import { fiveDate, rulesFrom } from "@/lib/daily-five";
import { makeFivePuzzle } from "@/lib/daily-five/server";
import { getGameSettings } from "@/lib/game-settings/server";
import type { Difficulty } from "@/games/types";
import { todayIso } from "./dates";
import { planRebuild, type RebuildSkip } from "./rebuild-plan";

export interface RebuildResult {
  game: string;
  dailies: { rebuilt: string[]; same: string[]; skipped: { date: string; reason: RebuildSkip }[]; pending: string[] };
  five: { rebuilt: string[]; same: string[]; skipped: { date: string; reason: RebuildSkip }[] };
}

/**
 * R4-14: after content is retired, rebuilds the game's upcoming generated Dailies and Daily Five days so none still
 * deals a retired entry (both are built up to 60 days ahead). Each day is rebuilt the way it was first made (the
 * Daily generator for the date, the Daily Five's own puzzle), now without the retired entries; a day whose board
 * comes out the same is left as it was. Locked days, custom items, today and Daily Five days already started stay
 * (planRebuild). Stops at the time budget; the rest are listed as pending (run it again). The caller audits it.
 */
export async function rebuildUpcoming(db: SupabaseClient, game: string, budgetMs = 40_000): Promise<RebuildResult> {
  const started = Date.now();
  const out: RebuildResult = {
    game,
    dailies: { rebuilt: [], same: [], skipped: [], pending: [] },
    five: { rebuilt: [], same: [], skipped: [] },
  };

  // Regular Dailies (GMT days).
  const today = todayIso();
  const { data: dailies, error } = await db
    .from("dailies")
    .select("date, puzzle_id, locked, puzzles!dailies_puzzle_id_fkey(seed, solution_hash)")
    .eq("game_id", game)
    .gt("date", today)
    .order("date");
  if (error) throw error;
  type D = { date: string; puzzle_id: string; locked: boolean; puzzles: { seed: string; solution_hash: string | null } | null };
  const dRows = ((dailies ?? []) as unknown as D[]).map((r) => ({ ...r, generated: r.puzzles?.seed === dailySeed(game, r.date) }));
  const dPlan = planRebuild(dRows, today);
  out.dailies.skipped = dPlan.skipped.map((d) => ({ date: d.date, reason: d.reason }));
  for (const d of dPlan.rebuild) {
    if (Date.now() - started > budgetMs) {
      out.dailies.pending.push(d.date);
      continue;
    }
    const row = await buildDailyPuzzle(game, d.date);
    if (row.solution_hash === d.puzzles?.solution_hash) {
      out.dailies.same.push(d.date);
      continue;
    }
    const { id } = await storeDailyPuzzle(db, row);
    if (id !== d.puzzle_id) {
      const { error: e } = await db.from("dailies").update({ puzzle_id: id }).eq("date", d.date).eq("game_id", game).eq("locked", false);
      if (e) throw e;
    }
    out.dailies.rebuilt.push(d.date);
  }

  // Daily Five days (from the reset hour), at the five's difficulty.
  const settings = await getGameSettings();
  const rules = rulesFrom(settings);
  const fiveToday = fiveDate(new Date(), rules.resetHour);
  const { data: five, error: e5 } = await db
    .from("daily_five")
    .select("date, slot, puzzle_id, locked, puzzles!daily_five_puzzle_id_fkey(seed, solution_hash, difficulty)")
    .eq("game_id", game)
    .gt("date", fiveToday)
    .order("date");
  if (e5) throw e5;
  type F = {
    date: string;
    slot: number;
    puzzle_id: string;
    locked: boolean;
    puzzles: { seed: string; solution_hash: string | null; difficulty: string } | null;
  };
  const fRows = (five ?? []) as unknown as F[];
  const played = new Map<string, number>();
  if (fRows.length) {
    const { data: att } = await db
      .from("attempts")
      .select("daily_date")
      .eq("daily_five", true)
      .eq("game_id", game)
      .in(
        "daily_date",
        fRows.map((r) => r.date),
      );
    for (const a of att ?? []) played.set(a.daily_date as string, (played.get(a.daily_date as string) ?? 0) + 1);
  }
  const fPlan = planRebuild(
    fRows.map((r) => ({ ...r, generated: true, played: played.get(r.date) ?? 0 })),
    fiveToday,
  );
  out.five.skipped = fPlan.skipped.map((d) => ({ date: d.date, reason: d.reason }));
  for (const f of fPlan.rebuild) {
    const before = f.puzzles?.solution_hash ?? null;
    const id = await makeFivePuzzle(db, game, f.date, (f.puzzles?.difficulty ?? rules.difficulty) as Difficulty);
    const { data: after } = await db.from("puzzles").select("solution_hash").eq("id", id).maybeSingle();
    if (id !== f.puzzle_id) {
      const { error: e } = await db
        .from("daily_five")
        .update({ puzzle_id: id, updated_at: new Date().toISOString() })
        .eq("date", f.date)
        .eq("slot", f.slot)
        .eq("locked", false);
      if (e) throw e;
    }
    if (id === f.puzzle_id && after?.solution_hash === before) out.five.same.push(f.date);
    else out.five.rebuilt.push(f.date);
  }
  return out;
}
