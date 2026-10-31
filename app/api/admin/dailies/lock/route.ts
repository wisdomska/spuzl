import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { addDays, ISO_DATE, todayIso } from "@/lib/admin/dates";

const Body = z.union([
  z.object({ date: z.string().regex(ISO_DATE), game: z.string().min(2).max(20), locked: z.boolean() }),
  z.object({ through: z.string().regex(ISO_DATE) }),
]);

/**
 * POST /api/admin/dailies/lock (FR-AD-02)
 * { date, game, locked }: lock or unlock one Daily. Dailies inside the next 7 days always stay locked.
 * { through }: lock every Daily from today through that date (at least the coming 7 days).
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("calendar.write");
  const b = await body(req, Body);
  const today = todayIso();
  if ("through" in b) {
    if (b.through < today) throw new ApiError(400, "past_date");
    const { data, error } = await ctx.db.rpc("svc_admin_lock_dailies", { p_from: today, p_through: b.through, p_actor: ctx.user.id });
    if (error) throw error;
    return ok({ locked: data as number });
  }
  if (!b.locked && b.date <= addDays(today, 7))
    throw new ApiError(409, "inside_lock_window", "Dailies inside the next 7 days stay locked. Use Swap Daily for emergencies.");
  const { data, error } = await ctx.db
    .from("dailies")
    .update(
      b.locked
        ? { locked: true, locked_at: new Date().toISOString(), locked_by: ctx.user.id }
        : { locked: false, locked_at: null, locked_by: null },
    )
    .eq("date", b.date)
    .eq("game_id", b.game)
    .select("date")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "daily_not_found");
  await audit(ctx, b.locked ? "daily.lock" : "daily.unlock", `${b.game}:${b.date}`);
  return ok({ locked: b.locked ? 1 : 0 });
});
