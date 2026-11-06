import { ApiError, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { addDays, ISO_DATE, todayIso } from "@/lib/admin/dates";
import { scheduleToJson } from "@/lib/daily-five";
import { exportDays } from "@/lib/daily-five/server";

/**
 * GET /api/admin/daily-five/export?from=yyyy-mm-dd&to=yyyy-mm-dd: the stored Daily Five days as JSON
 * ({filename, json}), in the format import reads back. Default: today and the next 30 days. Audited.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("dailyFive.read");
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") ?? todayIso();
  const to = sp.get("to") ?? addDays(from, 30);
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || to < from || to > addDays(from, 365)) throw new ApiError(400, "bad_range");
  const days = await exportDays(ctx.db, from, to);
  await audit(ctx, "daily_five.export", null, { from, to, days: days.length });
  return ok({ filename: `spuzl-daily-five-${from}-to-${to}.json`, json: scheduleToJson(days) });
});
