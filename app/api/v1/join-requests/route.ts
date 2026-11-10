import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { normalizeRoomCode } from "@/lib/multiplayer/roomCode";
import { createJoinRequest, pendingForHost, pendingForHostEverywhere } from "@/lib/multiplayer/server/joinRequests";

const Ask = z.object({ code: z.string().min(4).max(12) });

/**
 * POST /api/v1/join-requests {code}: ask to join a friends-only room (an under-16 host's Party room or friend duel)
 * by its code. Returns {id, status: pending|approved, host}, or {status: not_needed} when the player may just join.
 */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `join-request:${player.id}`, 20, 600);
  const code = normalizeRoomCode((await body(req, Ask)).code);
  if (!code) throw new ApiError(400, "bad_code");
  return ok(await createJoinRequest(admin, player.id, code));
});

/**
 * GET /api/v1/join-requests?match=<id>: the host's pending requests for the room they host now (host only).
 * GET /api/v1/join-requests (no match, R4-17): pending requests for every open room this player hosts, with each
 * room's code, for the Home card when the host has left the lobby.
 */
export const GET = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `join-requests-list:${player.id}`, 120, 60);
  const raw = new URL(req.url).searchParams.get("match");
  if (raw === null) return ok(await pendingForHostEverywhere(admin, player.id));
  const match = z.uuid().safeParse(raw);
  if (!match.success) throw new ApiError(400, "bad_match");
  return ok(await pendingForHost(admin, player.id, match.data));
});
