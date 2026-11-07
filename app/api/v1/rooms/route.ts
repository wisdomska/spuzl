import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { createRoom } from "@/lib/multiplayer/server/lobby";
import { confirmNotice, requireAdult, requireFamilyDraw } from "@/lib/multiplayer/server/adult";
import { RoomCreateInput } from "@/lib/multiplayer/roomInput";
import { isAdultMode, isFamilyDraw } from "@/lib/party-adult/modes";

/**
 * POST /api/v1/rooms: open a Party room (2 to 8) for any race game or a Random mix, or (18+ only, admin
 * setting "features.adultParty") a Draw It or Two Truths room, or (16+, signed in, "party.familyDraw", R2-P5) a Draw
 * It room with preset words and picks. Returns its 4-character code.
 */
export const POST = handle(async (req: Request) => {
  const { admin, user, player } = await requirePlayer();
  await rateLimit(admin, `room:${player.id}`, 20, 600);
  const input = await body(req, RoomCreateInput);
  if (isAdultMode(input.mode)) {
    const { noticeAt } = await requireAdult(admin, user, player);
    await confirmNotice(admin, player.id, noticeAt, input.adultNotice);
  }
  if (isFamilyDraw(input.mode)) await requireFamilyDraw(admin, user, player);
  return ok(await createRoom(admin, player.id, input));
});
