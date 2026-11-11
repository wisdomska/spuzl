import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin, type AdminCtx } from "@/lib/admin/auth";
import { ISO_DATE, todayIso } from "@/lib/admin/dates";
import { METRIC_IDS, metricCsv, metricRange, RANGE_DAYS, type MetricRow, type MetricsData, type RangeDays } from "@/lib/admin/metrics";
import { INSIGHT_IDS, insightCsv, isInsightId, previousRange } from "@/lib/admin/insights";

const Days = z.coerce
  .number()
  .int()
  .refine((d): d is RangeDays => (RANGE_DAYS as readonly number[]).includes(d), "days must be 7 or 30");
const End = z
  .string()
  .regex(ISO_DATE)
  .refine((d) => d <= todayIso(), "end cannot be in the future");

async function range(ctx: AdminCtx, from: string, to: string) {
  const { data, error } = await ctx.db.rpc("svc_admin_metrics", { p_from: from, p_to: to });
  if (error) throw error;
  return data as { total: MetricRow; days: MetricRow[] };
}

/** The range, and (for the page, not CSV) the same number of days straight before it for the comparisons. */
async function load(ctx: AdminCtx, days: RangeDays, end?: string, withPrevious = false): Promise<MetricsData> {
  const { from, to } = metricRange(days, end);
  const before = previousRange(from, days);
  const [d, p] = await Promise.all([range(ctx, from, to), withPrevious ? range(ctx, before.from, before.to) : null]);
  return { from, to, days, total: d.total, rows: d.days, ...(p ? { previous: { ...before, total: p.total } } : {}) };
}

/**
 * GET /api/admin/metrics?days=7|30&end=yyyy-mm-dd: the Metrics page numbers (players, return, play, together,
 * Sparks and shop, community, first time, then the detail and app-speed cards), per GMT day and for the range,
 * plus `previous`: the range total of the same number of days straight before. Aggregated in Postgres.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("metrics.read");
  const sp = new URL(req.url).searchParams;
  const days = Days.safeParse(sp.get("days") ?? "7");
  const end = sp.get("end") === null ? undefined : End.safeParse(sp.get("end"));
  if (!days.success || (end && !end.success)) throw new ApiError(400, "bad_range");
  return ok(await load(ctx, days.data, end?.data, true));
});

const Export = z.object({
  metric: z.enum([...METRIC_IDS, ...INSIGHT_IDS]),
  days: Days,
  end: End.optional(),
});

/** POST /api/admin/metrics {metric, days, end?}: one metric as CSV ({filename, csv}). Every export is audited. */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("metrics.read");
  const input = await body(req, Export);
  const data = await load(ctx, input.days, input.end);
  await audit(ctx, "metrics.export", `metric:${input.metric}`, { from: data.from, to: data.to, days: input.days });
  return ok({
    filename: `spuzl-${input.metric.replace(/_/g, "-")}-${data.from}-to-${data.to}.csv`,
    csv: isInsightId(input.metric) ? insightCsv(input.metric, data) : metricCsv(input.metric, data),
  });
});
