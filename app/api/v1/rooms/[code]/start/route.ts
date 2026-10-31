import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { startRoom } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";

/** POST /api/v1/rooms/:code/start: host starts once everyone is ready. Everyone gets the same puzzle. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/start">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room-start:${player.id}`, 60, 60);
  return ok(await startRoom(admin, player.id, code));
});
