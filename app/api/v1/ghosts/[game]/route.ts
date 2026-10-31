import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { startGhostRace } from "@/lib/multiplayer/server/async";

const Start = z.object({ run: z.string().uuid().optional() });

/** POST /api/v1/ghosts/:game: start a Ghost Race on today's track against a friend's best (or a shared run). */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/ghosts/[game]">) => {
  const { game } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `ghost:${player.id}`, 60, 600);
  return ok(await startGhostRace(admin, player.id, game, (await body(req, Start)).run));
});
