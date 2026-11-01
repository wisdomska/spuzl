import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { joinRoom } from "@/lib/multiplayer/server/lobby";
import { requireAdult } from "@/lib/multiplayer/server/adult";
import { codeParam } from "@/lib/multiplayer/server/params";

/** POST /api/v1/rooms/:code/join: join by code (case-insensitive) while the room is in its lobby. 18+ rooms check the age gate. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/join">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, user, player } = await requirePlayer();
  await rateLimit(admin, `room-join:${player.id}`, 60, 60);
  return ok(await joinRoom(admin, player.id, code, () => requireAdult(admin, user, player)));
});
