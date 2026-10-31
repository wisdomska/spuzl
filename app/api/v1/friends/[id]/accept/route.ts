import { z } from "zod";
import { ApiError, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";

/** POST /api/v1/friends/:id/accept: accept a pending request sent to you. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/friends/[id]/accept">) => {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(400, "invalid_id");
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `friend-edit:${player.id}`, 120, 3600);
  const { data, error } = await admin
    .from("friendships")
    .update({ status: "accepted" })
    .eq("player_id", id)
    .eq("friend_id", player.id)
    .eq("status", "pending")
    .select("player_id");
  if (error) throw error;
  if (!data?.length) throw new ApiError(404, "no_request", "That request is gone.");
  return ok({ ok: true });
});
