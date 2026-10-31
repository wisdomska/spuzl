import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { GAME_BY_ID } from "@/lib/catalog";

const Beat = z.object({ playing: z.string().max(32).nullable().optional() });

/** POST /api/v1/presence: heartbeat while the app is visible (friends see "Online" or "Playing X"). */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `presence:${player.id}`, 180, 3600);
  const input = await body(req, Beat);
  const playing = input.playing && GAME_BY_ID[input.playing] ? input.playing : null;
  const { error } = await admin.from("players").update({ last_seen_at: new Date().toISOString(), playing_game: playing }).eq("id", player.id);
  if (error) throw error;
  return ok({ ok: true });
});
