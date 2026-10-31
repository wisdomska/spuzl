import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { makeMove } from "@/lib/multiplayer/server/bay";

const Move = z.object({ ply: z.number().int().min(0).max(100_000), move: z.unknown().default(null) });

/** POST /api/v1/bay/:id/move: every move is checked with the game's rules on the server. Illegal moves get 422. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/bay/[id]/move">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `bay-move:${player.id}`, 120, 60);
  const input = await body(req, Move);
  return ok(await makeMove(admin, player.id, id, { ply: input.ply, move: input.move }));
});
