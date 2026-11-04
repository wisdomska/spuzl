import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { passRound } from "@/lib/multiplayer/server/match";

const Pass = z.object({ round: z.number().int().min(1).max(20) });

/** POST /api/v1/matches/:id/pass: sit out the current Party Race round (0 points for it, back for the next). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `pass:${player.id}`, 20, 60);
  return ok(await passRound(admin, id, player.id, (await body(req, Pass)).round));
});
