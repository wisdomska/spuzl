import { z } from "zod";
import { body, handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getPuzzle, logicFor } from "@/lib/admin/puzzles";
import { decodeSolution } from "@/lib/game/solution-codec";

const Body = z.object({ state: z.unknown() });

/** POST /api/admin/puzzles/:id/verify: Play test. The game's verify() judges the board state against the stored solution. */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/puzzles/[id]/verify">) => {
  const ctx = await requireAdmin("calendar.read");
  const id = z.string().uuid().parse((await rc.params).id);
  const { state } = await body(req, Body);
  const p = await getPuzzle(ctx.db, id);
  const logic = await logicFor(p.game_id);
  try {
    const v = logic.verify(p.data, decodeSolution(p.solution), state as never);
    return ok({ ok: v.ok, progress: v.progress, score: v.score ?? null, reason: v.reason ?? null });
  } catch {
    return ok({ ok: false, progress: 0, score: null, reason: "verify threw on this state" });
  }
});
