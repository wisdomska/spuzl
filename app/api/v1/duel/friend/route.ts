import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { friendDuel } from "@/lib/multiplayer/server/lobby";

const Friend = z.object({ game: z.string().min(2).max(24).nullable().default(null) });

/** POST /api/v1/duel/friend: an unranked Duel shared by link. The match starts when the friend joins. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `friend-duel:${player.id}`, 20, 600);
  const { game } = await body(req, Friend);
  return ok(await friendDuel(admin, player.id, game));
});
