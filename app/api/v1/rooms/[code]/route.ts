import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { roomPreview } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";

/** GET /api/v1/rooms/:code: members get the full room; anyone with the code gets the join card. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/rooms/[code]">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room-get:${player.id}`, 120, 60);
  return ok(await roomPreview(admin, code, player.id));
});
