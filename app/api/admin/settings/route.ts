import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { DEFAULTS, SETTINGS, mergeSettings, validateSetting } from "@/lib/game-settings/schema";
import { invalidateGameSettings } from "@/lib/game-settings/server";

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
      isDefault: current[key as keyof typeof current] === DEFAULTS[key as keyof typeof DEFAULTS],
      updatedAt: changed[key] ?? null,
    })),
  });
});

const Put = z.object({ key: z.string().min(3).max(80), value: z.union([z.number(), z.boolean()]) });

/** PUT /api/admin/settings: sets one tunable after validating it against its range. */
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
  return ok({ key, value });
});
