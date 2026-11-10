/**
 * R2-13: who may join a room by code. Rooms (Party and friend duels) hosted by a 13 to 15 player are friends only
 * while the admin setting "rooms.under16FriendsOnly" is on: the host's accepted friends join straight away, anyone
 * else asks and the host decides. Pure, shared by the server gate (the authority) and its tests.
 */
import { bandRank, effectiveBand } from "@/lib/age";

type BandRow = { age_band?: string | null; birth_year?: number | null; birth_month?: number | null };

/** Under 16 by the effective band (unknown counts as under 16, the careful reading). */
export const hostIsUnder16 = (row: BandRow, today: Date = new Date()) => bandRank(effectiveBand(row, today)) < bandRank("16-17");

/** Pending requests one room may hold at once; more wait until the host answers some. */
export const MAX_PENDING_PER_ROOM = 20;

export const JOIN_REQUEST_STATUSES = ["pending", "approved", "declined", "cancelled"] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

export interface JoinFacts {
  /** setting on and the current host is under 16 */
  friendsOnly: boolean;
  /** the player is the host */
  isHost: boolean;
  /** the player already holds a seat in this room (a rejoin after leaving, not after being removed) */
  wasMember: boolean;
  /** the host and the player are accepted friends */
  friends: boolean;
  /** either one has blocked the other */
  blocked: boolean;
  /** the host approved this player's request for this room */
  approved: boolean;
}

/**
 * R4-X (owner decision, 10 Nov 2026): what a host's data export says about requests they received: the asker's
 * nickname, the room (kind and code), when they asked and the outcome. Nothing else about the other player (no id,
 * no decision time). Pure, so the export route and its test agree.
 */
export function receivedForExport(
  rows: readonly { requester_id: string; room_kind: string; room_code: string; created_at: string; status: string }[],
  nicknames: ReadonlyMap<string, string>,
) {
  return rows.map((r) => ({
    requester_nickname: nicknames.get(r.requester_id) ?? null,
    room_kind: r.room_kind,
    room_code: r.room_code,
    requested_at: r.created_at,
    status: r.status,
  }));
}

/** "join": straight in; "ask": friends only, a request is needed (or was declined). */
export function joinAccess(f: JoinFacts): "join" | "ask" {
  if (f.isHost || f.wasMember || !f.friendsOnly) return "join";
  if (f.blocked) return "ask";
  return f.friends || f.approved ? "join" : "ask";
}
