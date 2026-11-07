import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { ISO_DATE, todayIso } from "@/lib/admin/dates";
import { weekStartOf } from "@/lib/leagues";
import { schoolLeagueCsv } from "@/lib/schools";
import { schoolLeague } from "@/lib/schools/server";

/** A Monday (GMT) no later than this week's. */
const Week = z
  .string()
  .regex(ISO_DATE)
  .refine((d) => d <= todayIso() && weekStartOf(new Date(`${d}T12:00:00Z`)) === d, "week must be a past or current Monday");

/**
 * GET /api/admin/schools/league?week=yyyy-mm-dd: the weekly school-vs-school table (R2-P5), this week by default,
 * as players see it (school names and aggregates only), whether or not "features.schoolLeagues" is on.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("schools.read");
  const raw = new URL(req.url).searchParams.get("week");
  const week = raw === null ? weekStartOf() : Week.safeParse(raw);
  if (typeof week !== "string" && !week.success) throw new ApiError(400, "bad_week");
  return ok(await schoolLeague(ctx.db, typeof week === "string" ? week : week.data));
});

/** POST /api/admin/schools/league { week }: the table as CSV ({filename, csv}). Every export is audited. */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("schools.read");
  const { week } = await body(req, z.object({ week: Week }).strict());
  const t = await schoolLeague(ctx.db, week);
  await audit(ctx, "schools.export", `school-league:${week}`, { week, metric: t.metric, rows: t.rows.length });
  return ok({ filename: `spuzl-school-league-${week}.csv`, csv: schoolLeagueCsv(week, t.metric, t.rows) });
});
