import { z } from "zod";
import { ApiError, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";

/** DELETE /api/v1/blocks/:id: unblock a player. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/v1/blocks/[id]">) => {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(400, "invalid_id");
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `block:${player.id}`, 60, 3600);
  const { error } = await admin.from("blocks").delete().eq("player_id", player.id).eq("blocked_id", id);
  if (error) throw error;
  return ok({ ok: true });
});
