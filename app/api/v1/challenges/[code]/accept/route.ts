import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { acceptChallenge } from "@/lib/multiplayer/server/async";

/** POST /api/v1/challenges/:code/accept: starts an attempt on the exact puzzle. Finish it with /attempts/:id/finish. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/challenges/[code]/accept">) => {
  const { code } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `challenge-accept:${player.id}`, 30, 600);
  return ok(await acceptChallenge(admin, player.id, code));
});
