import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { submitFinish } from "@/lib/multiplayer/server/match";

const Input = z.object({ round: z.number().int().min(1).max(20), state: z.unknown(), mistakes: z.number().int().min(0).max(10_000) });

/** POST /api/v1/matches/:id/finish: the board says solved. The server verifies, times it and decides the round. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/matches/[id]/finish">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `mp-finish:${player.id}`, 60, 60);
  return ok(await submitFinish(admin, id, player.id, await body(req, Input)));
});
