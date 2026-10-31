import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { getChallenge } from "@/lib/multiplayer/server/async";

/** GET /api/v1/challenges/:code: the challenge card (and your result once you've played it). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/challenges/[code]">) => {
  const { code } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `challenge-get:${player.id}`, 120, 60);
  return ok(await getChallenge(admin, player.id, code));
});
