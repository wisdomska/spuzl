import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { checkAndStore, freshPuzzle, getPuzzle, insertPuzzle, type SolveReport } from "./puzzles";

export interface DailyRow {
  date: string;
  game_id: string;
  puzzle_id: string;
  locked: boolean;
  swapped_from: string | null;
}

export async function getDaily(db: SupabaseClient, date: string, game: string): Promise<DailyRow | null> {
  const { data } = await db
    .from("dailies")
    .select("date, game_id, puzzle_id, locked, swapped_from")
    .eq("date", date)
    .eq("game_id", game)
    .maybeSingle();
  return (data as DailyRow | null) ?? null;
}

/** Retires a puzzle that no Daily uses any more (and that no attempt references, so nothing is orphaned). */
export async function retireIfUnused(db: SupabaseClient, puzzleId: string) {
  const { count } = await db.from("dailies").select("date", { count: "exact", head: true }).eq("puzzle_id", puzzleId);
  if (!count) await db.from("puzzles").update({ status: "retired" }).eq("id", puzzleId);
}

/**
 * Generates and stores a fresh puzzle for (game, date) that passes the solve-check. Failing candidates are
 * deleted (nothing references them yet). `status` is the stored status of the winner.
 */
export async function verifiedFreshPuzzle(
  db: SupabaseClient,
  game: string,
  date: string,
  tag: string,
  status: "in_review" | "approved",
  avoidHash?: string,
): Promise<{ id: string; report: SolveReport }> {
  for (let i = 0; i < 3; i++) {
    const f = await freshPuzzle(game, date, tag, avoidHash);
    const id = await insertPuzzle(db, { game_id: game, ...f }, { status });
    const report = await checkAndStore(db, await getPuzzle(db, id), date);
    if (report.ok) return { id, report };
    await db.from("puzzles").delete().eq("id", id);
  }
  throw new ApiError(422, "no_valid_puzzle", "Could not generate a puzzle that passes the solve-check.");
}
