import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { loadMatch } from "@/lib/multiplayer/server/match";
import { kick, requireAdult } from "@/lib/multiplayer/server/adult";
import { roomMatch } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";

const Kick = z.object({ playerId: z.uuid() });

/** POST /api/v1/rooms/:code/kick: the host of an 18+ party room removes a player. They can't rejoin that room. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/kick">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, user, player } = await requirePlayer();
  await rateLimit(admin, `room-kick:${player.id}`, 30, 60);
  const { playerId } = await body(req, Kick);
  await requireAdult(admin, user, player);
  const l = await loadMatch(admin, (await roomMatch(admin, code)).id);
  return ok(await kick(admin, l, player.id, playerId));
});
