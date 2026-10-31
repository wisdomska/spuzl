import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { bayAction } from "@/lib/multiplayer/server/bay";

const Action = z.object({
  action: z.enum(["resign", "draw_offer", "draw_accept", "draw_decline", "takeback_request", "takeback_accept", "takeback_decline", "nudge", "rematch"]),
});

/** POST /api/v1/bay/:id/action: resign, draw offers, takebacks (unranked only), nudges (async, after 12 h), rematch. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/bay/[id]/action">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `bay-action:${player.id}`, 60, 60);
  return ok(await bayAction(admin, player.id, id, (await body(req, Action)).action));
});
