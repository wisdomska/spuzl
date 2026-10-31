import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { hasLogic } from "@/games/logic-registry";
import { ISO_DATE, todayIso } from "@/lib/admin/dates";
import { getDaily, verifiedFreshPuzzle } from "@/lib/admin/dailies";

const Body = z.object({
  game: z.string().min(2).max(20),
  reason: z.string().trim().min(3).max(500),
  date: z.string().regex(ISO_DATE).optional(),
});

/**
 * POST /api/admin/dailies/swap: emergency "Swap Daily" (FR-AD-07). Replaces today's puzzle (or a later
 * locked one) with a freshly generated puzzle that passes the solve-check. The Daily keeps `swapped_from`,
 * the old puzzle is retired, and players mid-attempt finish on the puzzle they started.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("daily.swap");
  const { game, reason, date = todayIso() } = await body(req, Body);
  if (!hasLogic(game)) throw new ApiError(404, "unknown_game");
  if (date < todayIso()) throw new ApiError(409, "past_date");
  const current = await getDaily(ctx.db, date, game);
  if (!current) throw new ApiError(404, "daily_not_found");
  const { data: old } = await ctx.db.from("puzzles").select("solution_hash").eq("id", current.puzzle_id).single();
  const fresh = await verifiedFreshPuzzle(ctx.db, game, date, "swap", "approved", old?.solution_hash);
  const { data, error } = await ctx.db.rpc("svc_admin_swap_daily", {
    p_date: date,
    p_game: game,
    p_new: fresh.id,
    p_actor: ctx.user.id,
    p_reason: reason,
  });
  if (error) throw error;
  await ctx.db.from("puzzles").update({ reviewed_by: ctx.user.id, reviewed_at: new Date().toISOString() }).eq("id", fresh.id);
  return ok({ ...(data as object), report: fresh.report });
});
