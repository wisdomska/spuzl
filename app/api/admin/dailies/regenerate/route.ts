import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { hasLogic } from "@/games/logic-registry";
import { ISO_DATE, todayIso } from "@/lib/admin/dates";
import { getDaily, retireIfUnused, verifiedFreshPuzzle } from "@/lib/admin/dailies";

const Body = z.object({ date: z.string().regex(ISO_DATE), game: z.string().min(2).max(20) });

/**
 * POST /api/admin/dailies/regenerate: replaces an unlocked future Daily (or fills a missing one) with a
 * freshly generated puzzle that passes the solve-check. The new puzzle waits in review until approved.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("calendar.write");
  const { date, game } = await body(req, Body);
  if (!hasLogic(game)) throw new ApiError(404, "unknown_game");
  if (date <= todayIso()) throw new ApiError(409, "past_or_today", "Today's Daily changes only through Swap Daily.");
  const current = await getDaily(ctx.db, date, game);
  if (current?.locked) throw new ApiError(409, "locked", "This Daily is locked. Use Swap Daily for emergencies.");
  let avoid: string | undefined;
  if (current) {
    const { data } = await ctx.db.from("puzzles").select("solution_hash").eq("id", current.puzzle_id).single();
    avoid = data?.solution_hash;
  }
  const fresh = await verifiedFreshPuzzle(ctx.db, game, date, "regen", "in_review", avoid);
  const { error } = await ctx.db.from("dailies").upsert({ date, game_id: game, puzzle_id: fresh.id }, { onConflict: "date,game_id" });
  if (error) throw error;
  if (current) await retireIfUnused(ctx.db, current.puzzle_id);
  await audit(ctx, "daily.regenerate", `${game}:${date}`, { from: current?.puzzle_id ?? null, to: fresh.id });
  return ok({ puzzleId: fresh.id, report: fresh.report });
});
