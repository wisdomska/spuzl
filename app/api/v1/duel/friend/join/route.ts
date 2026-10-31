import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer, ApiError } from "@/lib/api/server";
import { joinFriendDuel } from "@/lib/multiplayer/server/lobby";
import { normalizeRoomCode } from "@/lib/multiplayer/roomCode";

const Join = z.object({ code: z.string().min(4).max(12) });

/** POST /api/v1/duel/friend/join: join a friend's Duel by code (case-insensitive). */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `join:${player.id}`, 30, 60);
  const code = normalizeRoomCode((await body(req, Join)).code);
  if (!code) throw new ApiError(400, "bad_code");
  return ok(await joinFriendDuel(admin, player.id, code));
});
