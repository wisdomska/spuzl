import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { nextGame } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";

/** POST /api/v1/rooms/:code/next: host starts the next game of the set from the podium. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/next">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room-next:${player.id}`, 60, 60);
  return ok(await nextGame(admin, player.id, code));
});
