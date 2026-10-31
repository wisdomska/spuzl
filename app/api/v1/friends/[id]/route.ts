import { z } from "zod";
import { ApiError, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";

/** DELETE /api/v1/friends/:id: decline a request, cancel your own, or remove a friend. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/v1/friends/[id]">) => {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(400, "invalid_id");
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `friend-edit:${player.id}`, 120, 3600);
  const { error } = await admin
    .from("friendships")
    .delete()
    .or(`and(player_id.eq.${player.id},friend_id.eq.${id}),and(player_id.eq.${id},friend_id.eq.${player.id})`);
  if (error) throw error;
  return ok({ ok: true });
});
