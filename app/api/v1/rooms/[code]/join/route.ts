import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { joinRoom } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";

/** POST /api/v1/rooms/:code/join: join by code (case-insensitive) while the room is in its lobby. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/join">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room-join:${player.id}`, 60, 60);
  return ok(await joinRoom(admin, player.id, code));
});
