import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { befriend } from "@/lib/social/server";
import { normaliseCode } from "@/lib/social";

const Accept = z.object({ code: z.string().trim().min(4).max(12) });

/** POST /api/v1/friends/invite/accept: opening someone's invite link or QR makes you friends. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `invite-accept:${player.id}`, 30, 3600);
  const { code } = await body(req, Accept);
  const { data: inv } = await admin.from("invites").select("player_id").eq("code", normaliseCode(code)).maybeSingle();
  if (!inv) throw new ApiError(404, "not_found", "That invite doesn't work any more.");
  await befriend(admin, player.id, inv.player_id);
  const { data: who } = await admin.from("players").select("nickname").eq("id", inv.player_id).maybeSingle();
  return ok({ ok: true, nickname: who?.nickname ?? null });
});
