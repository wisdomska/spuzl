import { z } from "zod";
import { body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { getGameSettings } from "@/lib/game-settings/server";
import { parseSchedule } from "@/lib/daily-five";
import { importDays, schedulableGame } from "@/lib/daily-five/server";

const Import = z.object({ json: z.string().min(2).max(200_000), dryRun: z.boolean().optional() });

/**
 * POST /api/admin/daily-five/import {json, dryRun?}: reads a schedule made by export (or by hand). Every row is
 * checked first and nothing is saved when any row fails (422 with the list). Valid days become manual picks,
 * locked when the file says so; past, locked and already-played days are skipped and listed. Audited.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("dailyFive.write");
  const input = await body(req, Import);
  const settings = await getGameSettings();
  const parsed = parseSchedule(input.json, (id) => schedulableGame(id, settings));
  if (!parsed.ok) return Response.json({ error: "invalid_schedule", errors: parsed.errors.slice(0, 50) }, { status: 422 });
  if (input.dryRun) return ok({ valid: parsed.days.length, saved: [], skipped: [] });
  const r = await importDays(ctx.db, parsed.days, ctx.user.id);
  await audit(ctx, "daily_five.import", null, { days: parsed.days.length, saved: r.saved, skipped: r.skipped });
  return ok({ valid: parsed.days.length, ...r });
});
