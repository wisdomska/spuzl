import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { getPuzzle } from "@/lib/admin/puzzles";
import { decodeSolution } from "@/lib/game/solution-codec";
import { dailyNumber } from "@/lib/format";

const Id = z.string().uuid();

/** GET /api/admin/puzzles/:id: puzzle, decoded answer key, its Daily slots and the last solve-check report. */
export const GET = handle(async (_req: Request, rc: RouteContext<"/api/admin/puzzles/[id]">) => {
  const ctx = await requireAdmin("calendar.read");
  const id = Id.parse((await rc.params).id);
  const p = await getPuzzle(ctx.db, id);
  const { data: slots } = await ctx.db
    .from("dailies")
    .select("date, game_id, locked, locked_at, swapped_from, swapped_at, published_at")
    .eq("puzzle_id", id)
    .order("date");
  const { data: swappedOut } = await ctx.db.from("dailies").select("date, game_id").eq("swapped_from", id);
  return ok({
    puzzle: { ...p, solution: decodeSolution(p.solution) },
    dailies: (slots ?? []).map((d) => ({ ...d, number: dailyNumber(d.date) })),
    swappedOut: swappedOut ?? [],
  });
});

const Patch = z.object({ note: z.string().max(2000) });

/** PATCH /api/admin/puzzles/:id: saves the reviewer note. */
export const PATCH = handle(async (req: Request, rc: RouteContext<"/api/admin/puzzles/[id]">) => {
  const ctx = await requireAdmin("calendar.write");
  const id = Id.parse((await rc.params).id);
  const { note } = await body(req, Patch);
  const { data, error } = await ctx.db.from("puzzles").update({ reviewer_note: note || null }).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "puzzle_not_found");
  await audit(ctx, "puzzle.note", `puzzle:${id}`, { note });
  return ok({ ok: true });
});
