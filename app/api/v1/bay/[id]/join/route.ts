import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { joinBay } from "@/lib/multiplayer/server/bay";

const Join = z.object({ code: z.string().min(4).max(8) });

/** POST /api/v1/bay/:id/join: accept an invite. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/bay/[id]/join">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `bay-join:${player.id}`, 30, 60);
  return ok(await joinBay(admin, player.id, id, (await body(req, Join)).code));
});
