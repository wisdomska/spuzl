import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { saveAttempt } from "@/lib/game/service";

const Save = z.object({ state: z.unknown(), activeMs: z.number().min(0).max(86_400_000) });

/** PATCH /api/v1/attempts/:id: autosave every 10 s or on pause (FR-GP-05). */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/v1/attempts/[id]">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `save:${player.id}`, 600, 3600);
  const input = await body(req, Save);
  await saveAttempt(admin, player.id, id, input.state, input.activeMs);
  return ok({ ok: true });
});
