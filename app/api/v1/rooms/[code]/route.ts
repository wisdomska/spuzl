import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { roomPreview } from "@/lib/multiplayer/server/lobby";
import { requireAdult } from "@/lib/multiplayer/server/adult";
import { codeParam } from "@/lib/multiplayer/server/params";

/** GET /api/v1/rooms/:code: members get the full room; anyone with the code gets the join card (18+ rooms: 18+ only). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/rooms/[code]">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, user, player } = await requirePlayer();
  await rateLimit(admin, `room-get:${player.id}`, 120, 60);
  return ok(await roomPreview(admin, code, player.id, () => requireAdult(admin, user, player)));
});
