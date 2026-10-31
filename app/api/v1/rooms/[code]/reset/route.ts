import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { runItBack } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";

/** POST /api/v1/rooms/:code/reset: Run it back. Same room, new set, fresh puzzles. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/reset">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room-reset:${player.id}`, 60, 60);
  return ok(await runItBack(admin, player.id, code));
});
