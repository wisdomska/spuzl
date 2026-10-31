import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { createRoom } from "@/lib/multiplayer/server/lobby";
import { PARTY_MAX, PARTY_MIN } from "@/lib/multiplayer/constants";

const Create = z.object({
  game: z.string().min(2).max(24).nullable().default(null),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]).default("medium"),
  maxPlayers: z.number().int().min(PARTY_MIN).max(PARTY_MAX).default(PARTY_MAX),
  classroom: z.boolean().default(false),
});

/** POST /api/v1/rooms: open a Party room (2 to 8). Returns its 4-character code. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room:${player.id}`, 20, 600);
  return ok(await createRoom(admin, player.id, await body(req, Create)));
});
