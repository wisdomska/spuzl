import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { joinRoom } from "@/lib/multiplayer/server/lobby";
import { requirePartyMode } from "@/lib/multiplayer/server/adult";
import { codeParam } from "@/lib/multiplayer/server/params";

/** POST /api/v1/rooms/:code/join: join by code (case-insensitive) while the room is in its lobby. Turn-based rooms check their age gate (18+, or 16+ for Draw It with preset words). */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/join">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, user, player } = await requirePlayer();
  await rateLimit(admin, `room-join:${player.id}`, 60, 60);
  return ok(await joinRoom(admin, player.id, code, (mode) => requirePartyMode(admin, user, player, mode)));
});
