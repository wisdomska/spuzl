import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { difficultyForDate } from "@/games/types";
import { ISO_DATE, todayIso } from "@/lib/admin/dates";
import { SCHEDULABLE, isContentGame } from "@/lib/admin/content-schemas";
import { buildFromItem } from "@/lib/admin/content-files";
import { checkAndStore, getPuzzle, canonicalHash, insertPuzzle } from "@/lib/admin/puzzles";
import { getDaily, retireIfUnused } from "@/lib/admin/dailies";

const Body = z.object({ itemId: z.string().uuid(), date: z.string().regex(ISO_DATE) });

/**
 * POST /api/admin/dailies/schedule: puts an approved content item on a Daily (FR-AD-03). The puzzle is built
 * by the game's own generator, stored as human content, solve-checked, and the Daily slot is filled or
 * replaced (never a locked one).
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("calendar.write");
  const { itemId, date } = await body(req, Body);
  if (date <= todayIso()) throw new ApiError(409, "past_or_today");
  const { data: item } = await ctx.db.from("content_items").select("id, game_id, payload, status").eq("id", itemId).maybeSingle();
  if (!item) throw new ApiError(404, "item_not_found");
  if (item.status !== "approved") throw new ApiError(409, "not_approved", "Only approved items can be scheduled.");
  const game = item.game_id as string;
  const plan = isContentGame(game) ? SCHEDULABLE[game] : undefined;
  if (!plan) throw new ApiError(409, "not_schedulable", "Items for this game join the content pool instead of a single Daily.");
  const current = await getDaily(ctx.db, date, game);
  if (current?.locked) throw new ApiError(409, "locked");

  const difficulty = difficultyForDate(date);
  const gen = await buildFromItem(game as never, item.payload, difficulty);
  const puzzleId = await insertPuzzle(
    ctx.db,
    { game_id: game, seed: `item:${itemId}:${date}`, difficulty, gen, hash: canonicalHash(gen.solution) },
    { status: "scheduled", source: "human", content_item_id: itemId, reviewed_by: ctx.user.id },
  );
  const report = await checkAndStore(ctx.db, await getPuzzle(ctx.db, puzzleId), date);
  if (!report.ok) {
    await ctx.db.from("puzzles").delete().eq("id", puzzleId);
    return Response.json({ error: "check_failed", report }, { status: 422 });
  }
  const { error } = await ctx.db.from("dailies").upsert({ date, game_id: game, puzzle_id: puzzleId }, { onConflict: "date,game_id" });
  if (error) throw error;
  if (current) await retireIfUnused(ctx.db, current.puzzle_id);
  await ctx.db
    .from("content_items")
    .update({ status: "scheduled", scheduled_for: date, puzzle_id: puzzleId, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  await audit(ctx, "content.schedule", `content:${itemId}`, { game, date, puzzle: puzzleId, replaced: current?.puzzle_id ?? null });
  return ok({ puzzleId, report });
});
