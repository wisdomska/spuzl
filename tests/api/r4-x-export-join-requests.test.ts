import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, BASE, guest, uniq } from "./helpers";
import { setSetting } from "./setup";

/**
 * R4-X (owner decision, 10 Nov 2026): the player's data export lists the join requests they made, in full, and the
 * requests they received as host with only the asker's nickname, the room, the time and the outcome. Needs
 * `supabase start` and the dev server (API_BASE).
 */
const KEY = "rooms.under16FriendsOnly";
let before: unknown;
beforeAll(async () => {
  const { data } = await admin().from("game_settings").select("value").eq("key", KEY).maybeSingle();
  before = data?.value;
  await setSetting(KEY, true);
});
afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", KEY);
  else await setSetting(KEY, before);
});

const exportOf = async (token: string) =>
  (await fetch(BASE + "/api/v1/account/export", { headers: { authorization: `Bearer ${token}` } })).json();

describe("api: join requests in the data export (R4-X)", () => {
  it("made in full for the asker; received with nickname, room, time and status only for the host", async () => {
    const host = await guest(uniq("xh_"), "13-15");
    const askerName = uniq("xa_");
    const asker = await guest(askerName);
    const room = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 4 } });
    const req = await asker.api("/api/v1/join-requests", { json: { code: room.data.code } });
    expect(req.data.status).toBe("pending");
    await host.api(`/api/v1/join-requests/${req.data.id}`, { json: { decision: "decline" } });

    const mine = await exportOf(asker.token);
    expect(mine.join_requests_made).toHaveLength(1);
    expect(mine.join_requests_made[0]).toMatchObject({
      id: req.data.id,
      room_code: room.data.code,
      room_kind: "party",
      requester_id: asker.userId,
      host_id: host.userId,
      status: "declined",
    });
    expect(mine.join_requests_received).toEqual([]);

    const theirs = await exportOf(host.token);
    expect(theirs.join_requests_made).toEqual([]);
    expect(theirs.join_requests_received).toEqual([
      {
        requester_nickname: askerName,
        room_kind: "party",
        room_code: room.data.code,
        requested_at: expect.any(String),
        status: "declined",
      },
    ]);
    // Nothing that identifies the asker beyond the nickname.
    expect(JSON.stringify(theirs.join_requests_received)).not.toContain(asker.userId);
  });
});
