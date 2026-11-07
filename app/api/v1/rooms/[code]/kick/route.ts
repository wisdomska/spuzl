import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { loadMatch } from "@/lib/multiplayer/server/match";
import { kick, modeOf, requirePartyMode } from "@/lib/multiplayer/server/adult";
import { roomMatch } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";

const Kick = z.object({ playerId: z.uuid() });

/** POST /api/v1/rooms/:code/kick: the host of a turn-based party room (18+ or 16+) removes a player. They can't rejoin it. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/kick">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, user, player } = await requirePlayer();
  await rateLimit(admin, `room-kick:${player.id}`, 30, 60);
  const { playerId } = await body(req, Kick);
  const m = await roomMatch(admin, code);
  await requirePartyMode(admin, user, player, modeOf(m));
  const l = await loadMatch(admin, m.id);
  return ok(await kick(admin, l, player.id, playerId));
});
