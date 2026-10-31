import { handle, ok, requirePlayer } from "@/lib/api/server";
import { getBay } from "@/lib/multiplayer/server/bay";

/** GET /api/v1/bay/:id: the shared board, clocks and offers. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/bay/[id]">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  return ok(await getBay(admin, id, player.id));
});
