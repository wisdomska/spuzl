import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { addDays, ISO_DATE } from "@/lib/admin/dates";
import { getGameSettings } from "@/lib/game-settings/server";
import { FIVE_SLOTS, fiveDate, rulesFrom } from "@/lib/daily-five";
import { adminAutoPick, adminDays, adminLock, adminManualPick, fiveCandidates, fillFive } from "@/lib/daily-five/server";
import { GAME_BY_ID } from "@/lib/catalog";

const MAX_SPAN = 62;

/**
 * GET /api/admin/daily-five?from=yyyy-mm-dd&days=14: the Daily Five scheduler. Each day's five (stored, or a preview
 * of the auto-pick for days not stored yet), its lock, source and how many Daily Five attempts it has, plus the
 * games that can be picked and the current composition rules.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("dailyFive.read");
  const sp = new URL(req.url).searchParams;
  const settings = await getGameSettings();
  const rules = rulesFrom(settings);
  const today = fiveDate(new Date(), rules.resetHour);
  const from = sp.get("from") ?? today;
  const days = Number(sp.get("days") ?? 14);
  if (!ISO_DATE.test(from) || !Number.isInteger(days) || days < 1 || days > MAX_SPAN) throw new ApiError(400, "bad_range");
  const to = addDays(from, days - 1);
  const [list, candidates] = await Promise.all([adminDays(ctx.db, from, to), fiveCandidates(settings)]);
  return ok({
    today,
    from,
    to,
    enabled: settings["dailyFive.enabled"],
    rules,
    days: list,
    games: candidates
      .map((c) => ({ id: c.id, name: GAME_BY_ID[c.id]?.name ?? c.id, world: c.world, typicalSec: c.typicalSec }))
      .sort((a, b) => a.world.localeCompare(b.world) || a.name.localeCompare(b.name)),
  });
});

const Date_ = z.string().regex(ISO_DATE);
const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("auto"), date: Date_ }),
  z.object({ action: z.literal("manual"), date: Date_, games: z.array(z.string().min(2).max(24)).length(FIVE_SLOTS) }),
  z.object({ action: z.literal("lock"), date: Date_, locked: z.boolean() }),
  z.object({ action: z.literal("fill") }),
]);

/**
 * POST /api/admin/daily-five: one scheduler action, role-checked and audited.
 *   {action: "auto", date}            re-run the auto-pick for a day (not locked, not started, not past)
 *   {action: "manual", date, games}   pick the day's five by hand, in slot order
 *   {action: "lock", date, locked}    lock (the auto-pick never changes it) or unlock a day
 *   {action: "fill"}                  run the scheduler now (what the daily cron does)
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("dailyFive.write");
  const a = await body(req, Action);
  if (a.action === "auto") {
    const r = await adminAutoPick(ctx.db, a.date, ctx.user.id);
    await audit(ctx, "daily_five.auto_pick", `daily_five:${a.date}`, r);
    return ok(r);
  }
  if (a.action === "manual") {
    const r = await adminManualPick(ctx.db, a.date, a.games, ctx.user.id);
    await audit(ctx, "daily_five.manual_pick", `daily_five:${a.date}`, r);
    return ok(r);
  }
  if (a.action === "lock") {
    const r = await adminLock(ctx.db, a.date, a.locked, ctx.user.id);
    await audit(ctx, a.locked ? "daily_five.lock" : "daily_five.unlock", `daily_five:${a.date}`, r);
    return ok(r);
  }
  const r = await fillFive(ctx.db);
  await audit(ctx, "daily_five.fill", null, r);
  return ok(r);
});
