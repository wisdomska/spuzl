import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { blockPlayer } from "@/lib/social/server";

const Report = z.object({
  playerId: z.uuid(),
  reason: z.enum(["nickname", "cheating", "harassment", "spam", "other"]),
  block: z.boolean().default(false),
});

/** POST /api/v1/reports: report a player. A human checks every report (24 h SLA). Optionally block them too. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `report:${player.id}`, 20, 3600);
  const input = await body(req, Report);
  if (input.playerId === player.id) throw new ApiError(400, "self");
  const { data: target } = await admin.from("players").select("id").eq("id", input.playerId).maybeSingle();
  if (!target) throw new ApiError(404, "not_found");
  // One open report per reporter, target and reason is enough for the moderation queue.
  const { data: open } = await admin
    .from("reports")
    .select("id")
    .eq("reporter_id", player.id)
    .eq("target_type", input.reason === "nickname" ? "nickname" : "player")
    .eq("target_id", input.playerId)
    .eq("reason", input.reason)
    .eq("status", "open")
    .maybeSingle();
  if (!open) {
    const { error } = await admin.from("reports").insert({
      reporter_id: player.id,
      target_type: input.reason === "nickname" ? "nickname" : "player",
      target_id: input.playerId,
      reason: input.reason,
    });
    if (error) throw error;
  }
  if (input.block) await blockPlayer(admin, player.id, input.playerId);
  return ok({ ok: true });
});
