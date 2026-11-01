import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { createRoom } from "@/lib/multiplayer/server/lobby";
import { RoomCreateInput } from "@/lib/multiplayer/roomInput";

/** POST /api/v1/rooms: open a Party room (2 to 8) for any race game or a Random mix. Returns its 4-character code. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room:${player.id}`, 20, 600);
  return ok(await createRoom(admin, player.id, await body(req, RoomCreateInput)));
});
