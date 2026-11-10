import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { DEFAULTS, SETTINGS, SETTING_LIST_MAX, mergeSettings, sameSetting, validateSetting } from "@/lib/game-settings/schema";
import { getGameSettings, invalidateGameSettings } from "@/lib/game-settings/server";
import { repickClosedGames } from "@/lib/daily-five/server";

/** GET /api/admin/settings: every tunable with its definition, current value and last change. */
export const GET = handle(async () => {
  const ctx = await requireAdmin("settings.read");
  const { data, error } = await ctx.db.from("game_settings").select("key, value, updated_at");
  if (error) throw error;
  const current = mergeSettings(data ?? []);
  const changed = Object.fromEntries((data ?? []).map((r) => [r.key, r.updated_at]));
  return ok({
    rows: Object.entries(SETTINGS).map(([key, def]) => ({
      key,
      def,
      value: current[key as keyof typeof current],
      isDefault: sameSetting(current[key as keyof typeof current], DEFAULTS[key as keyof typeof DEFAULTS]),
      updatedAt: changed[key] ?? null,
    })),
  });
});

const Put = z.object({
  key: z.string().min(3).max(80),
  value: z.union([z.number(), z.boolean(), z.string().max(40), z.array(z.string().max(32)).max(SETTING_LIST_MAX)]),
});

/** PUT /api/admin/settings: sets one tunable after validating it against its range (or its options). */
export const PUT = handle(async (req: Request) => {
  const ctx = await requireAdmin("settings.write");
  const { key, value } = await body(req, Put);
  const problem = validateSetting(key, value);
  if (problem) throw new ApiError(422, "invalid_setting", problem);
  const { data: before } = await ctx.db.from("game_settings").select("value").eq("key", key).maybeSingle();
  const { error } = await ctx.db
    .from("game_settings")
    .upsert({ key, value, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  invalidateGameSettings();
  await audit(ctx, "setting.update", `setting:${key}`, { before: before?.value ?? null, after: value });
  // R4-06: a lab game switched off leaves today's and upcoming unlocked Daily Five days at once (audited), so the
  // server never refuses a slot it scheduled.
  let dailyFive: Awaited<ReturnType<typeof repickClosedGames>> | undefined;
  const was = Array.isArray(before?.value) ? (before.value as string[]) : (DEFAULTS["features.labGames"] as readonly string[]);
  if (key === "features.labGames" && Array.isArray(value) && was.some((g) => !value.includes(g))) {
    dailyFive = await repickClosedGames(ctx.db, await getGameSettings(), ctx.user.id);
    if (dailyFive.days.length || dailyFive.kept.length)
      await audit(ctx, "daily_five.lab_repick", null, { off: was.filter((g) => !value.includes(g)), ...dailyFive });
  }
  return ok({ key, value, ...(dailyFive ? { dailyFive } : {}) });
});
