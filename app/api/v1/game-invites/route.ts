import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { sendGameInvite } from "@/lib/multiplayer/server/invites";

const Invite = z.object({
  to: z.string().uuid(),
  kind: z.enum(["duel", "party", "bay"]),
  target: z.string().min(4).max(64),
});

/** POST /api/v1/game-invites: invite a friend into your open Duel, Party room or Board Games invite. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `game-invite:${player.id}`, 40, 600);
  return ok(await sendGameInvite(admin, player.id, await body(req, Invite)));
});
