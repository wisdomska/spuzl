import { z } from "zod";
import { handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { checkAndStore, getPuzzle } from "@/lib/admin/puzzles";
import { ISO_DATE } from "@/lib/admin/dates";

/**
 * POST /api/admin/puzzles/:id/check?date=YYYY-MM-DD: runs the solve-check (countSolutions, verify against
 * the stored solution, hash, seed rebuild, repeats, real solve times) and stores the report.
 */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/puzzles/[id]/check">) => {
  const ctx = await requireAdmin("calendar.write");
  const id = z.string().uuid().parse((await rc.params).id);
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  if (date && !ISO_DATE.test(date)) throw new ApiError(400, "bad_date");
  const p = await getPuzzle(ctx.db, id);
  const report = await checkAndStore(ctx.db, p, date);
  await audit(ctx, "puzzle.check", `puzzle:${id}`, { ok: report.ok, failed: report.checks.filter((c) => c.status === "fail").map((c) => c.id) });
  return ok(report);
});
