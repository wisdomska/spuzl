import { z } from "zod";
import { body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { fillSchedule } from "@/lib/game/schedule";

const Body = z.object({ days: z.number().int().min(1).max(60).default(14) });

/** POST /api/admin/dailies/fill: "Generate gaps". Fills missing Dailies with the solver-checked scheduler. */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("calendar.write");
  const { days } = await body(req, Body);
  const r = await fillSchedule(ctx.db, { days, budgetMs: 25_000 });
  await audit(ctx, "daily.fill", `next ${days} days`, r);
  return ok(r);
});
