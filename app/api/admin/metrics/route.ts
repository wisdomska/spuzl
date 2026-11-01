import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin, type AdminCtx } from "@/lib/admin/auth";
import { ISO_DATE, todayIso } from "@/lib/admin/dates";
import { METRIC_IDS, metricCsv, metricRange, RANGE_DAYS, type MetricRow, type MetricsData, type RangeDays } from "@/lib/admin/metrics";

const Days = z.coerce
  .number()
  .int()
  .refine((d): d is RangeDays => (RANGE_DAYS as readonly number[]).includes(d), "days must be 7 or 30");
const End = z
  .string()
  .regex(ISO_DATE)
  .refine((d) => d <= todayIso(), "end cannot be in the future");

async function load(ctx: AdminCtx, days: RangeDays, end?: string): Promise<MetricsData> {
  const { from, to } = metricRange(days, end);
  const { data, error } = await ctx.db.rpc("svc_admin_metrics", { p_from: from, p_to: to });
  if (error) throw error;
  const d = data as { total: MetricRow; days: MetricRow[] };
  return { from, to, days, total: d.total, rows: d.days };
}

/**
 * GET /api/admin/metrics?days=7|30&end=yyyy-mm-dd: the Metrics page numbers (tap-to-board, onboarding, first
 * move, hints, duels, Daily completion, shares), per GMT day and for the range. Aggregated in Postgres.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("metrics.read");
  const sp = new URL(req.url).searchParams;
  const days = Days.safeParse(sp.get("days") ?? "7");
  const end = sp.get("end") === null ? undefined : End.safeParse(sp.get("end"));
  if (!days.success || (end && !end.success)) throw new ApiError(400, "bad_range");
  return ok(await load(ctx, days.data, end?.data));
});

const Export = z.object({
  metric: z.enum(METRIC_IDS),
  days: Days,
  end: End.optional(),
});

/** POST /api/admin/metrics {metric, days, end?}: one metric as CSV ({filename, csv}). Every export is audited. */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("metrics.read");
  const input = await body(req, Export);
  const data = await load(ctx, input.days, input.end);
  await audit(ctx, "metrics.export", `metric:${input.metric}`, { from: data.from, to: data.to, days: input.days });
  return ok({ filename: `spuzl-${input.metric.replace(/_/g, "-")}-${data.from}-to-${data.to}.csv`, csv: metricCsv(input.metric, data) });
});
