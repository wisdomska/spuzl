import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { checkAndStore, getPuzzle } from "@/lib/admin/puzzles";
import { ISO_DATE } from "@/lib/admin/dates";

const Body = z.object({ note: z.string().max(2000).optional(), date: z.string().regex(ISO_DATE).optional() });

/**
 * POST /api/admin/puzzles/:id/approve: re-runs the solve-check and, if nothing fails, marks the puzzle
 * verified for scheduling with the reviewer and note. A failing check refuses with the report.
 */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/puzzles/[id]/approve">) => {
  const ctx = await requireAdmin("calendar.write");
  const id = z
    .string()
    .uuid()
    .parse((await rc.params).id);
  const { note, date } = await body(req, Body);
  const p = await getPuzzle(ctx.db, id);
  if (p.status === "retired") throw new ApiError(409, "retired");
  const report = await checkAndStore(ctx.db, p, date);
  if (!report.ok) return Response.json({ error: "check_failed", report }, { status: 422 });
  const { error } = await ctx.db
    .from("puzzles")
    .update({
      status: "scheduled",
      reviewed_by: ctx.user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_note: note === undefined ? p.reviewer_note : note || null,
    })
    .eq("id", id);
  if (error) throw error;
  await audit(ctx, "puzzle.approve", `puzzle:${id}`, { game: p.game_id, date, note });
  return ok({ ok: true, report });
});
