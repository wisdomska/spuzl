import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer, ApiError } from "@/lib/api/server";
import { resolveCode } from "@/lib/multiplayer/server/lobby";
import { normalizeRoomCode } from "@/lib/multiplayer/roomCode";

const Code = z.object({ code: z.string().min(4).max(12) });

/** POST /api/v1/codes: where a friend's code leads (a Duel, a Party room or a Board Games invite). Joins nothing. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  // shares the join budget: the code box is a way in, so guessing codes costs the same as joining
  await rateLimit(admin, `join:${player.id}`, 30, 60);
  const code = normalizeRoomCode((await body(req, Code)).code);
  if (!code) throw new ApiError(400, "bad_code");
  return ok(await resolveCode(admin, code));
});
