import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/push/prefs: the player's alert switches (Settings > Alerts). No stored row means the defaults
 * (streak reminders on). They only matter while alerts are on for a device (POST /api/v1/push).
 */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const { data, error } = await admin.from("alert_prefs").select("streak_nudge").eq("player_id", player.id).maybeSingle();
  if (error) throw error;
  return ok({ streakNudge: data?.streak_nudge ?? true });
});

const Prefs = z.object({ streakNudge: z.boolean() });

/** PUT /api/v1/push/prefs {streakNudge}: turn the evening streak reminder (R3-09) on or off for every device. */
export const PUT = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `push-prefs:${player.id}`, 30, 3600);
  const { streakNudge } = await body(req, Prefs);
  const { error } = await admin
    .from("alert_prefs")
    .upsert({ player_id: player.id, streak_nudge: streakNudge, updated_at: new Date().toISOString() }, { onConflict: "player_id" });
  if (error) throw error;
  return ok({ streakNudge });
});
