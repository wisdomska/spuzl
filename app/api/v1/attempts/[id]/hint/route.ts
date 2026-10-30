import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { hintFor } from "@/lib/game/service";

const HintReq = z.object({ state: z.unknown() });

/** POST /api/v1/attempts/:id/hint: one safe deduction computed server-side (solutions never reach the client). */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/attempts/[id]/hint">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `hint:${player.id}`, 60, 3600);
  const { state } = await body(req, HintReq);
  return ok({ hint: await hintFor(admin, player.id, id, state) });
});
