import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, guest, uniq, type Band } from "./helpers";
import { setSetting } from "./setup";

/**
 * R4-17: a friends-only host (13 to 15) who left the lobby sees pending requests on Home: GET /api/v1/join-requests
 * (no match) lists every pending request for open rooms they host, with the room's code; the host answers there
 * with the usual POST /api/v1/join-requests/:id. Nobody else sees them. Needs `supabase start` and the dev server.
 */
type G = Awaited<ReturnType<typeof guest>>;
const KEY = "rooms.under16FriendsOnly";
const player = (prefix: string, band: Band = "18+") => guest(uniq(prefix), band);

async function partyRoom(host: G): Promise<{ code: string; matchId: string }> {
  const r = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 4 } });
  expect(r.status).toBe(200);
  return r.data;
}

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

describe("api: join requests on Home (R4-17)", () => {
  it("lists the host's pending requests across rooms, and the host answers from there", async () => {
    const host = await player("hh_", "13-15");
    const a = await player("ha_");
    const b = await player("hb_");
    const one = await partyRoom(host);
    const two = await partyRoom(host);
    const ra = await a.api("/api/v1/join-requests", { json: { code: one.code } });
    const rb = await b.api("/api/v1/join-requests", { json: { code: two.code } });
    expect(ra.data.status).toBe("pending");
    expect(rb.data.status).toBe("pending");

    const list = await host.api("/api/v1/join-requests");
    expect(list.status).toBe(200);
    const byId = new Map((list.data.requests as { id: string; code: string; kind: string; nickname: string }[]).map((r) => [r.id, r]));
    expect(byId.get(ra.data.id)).toMatchObject({ code: one.code, kind: "party" });
    expect(byId.get(rb.data.id)).toMatchObject({ code: two.code, kind: "party" });
    // Only what the lobby shows about the asker.
    expect(Object.keys(byId.get(ra.data.id)!).sort()).toEqual(["at", "code", "color", "hat", "id", "kind", "nickname"]);

    expect((await host.api(`/api/v1/join-requests/${ra.data.id}`, { json: { decision: "approve" } })).data.status).toBe("approved");
    expect((await host.api(`/api/v1/join-requests/${rb.data.id}`, { json: { decision: "decline" } })).data.status).toBe("declined");
    expect((await host.api("/api/v1/join-requests")).data.requests).toEqual([]);
    // The approved asker can now join by code.
    expect((await a.api(`/api/v1/rooms/${one.code}/join`, { json: {} })).status).toBe(200);
  });

  it("shows other players nothing, and drops rooms the host no longer has open", async () => {
    const host = await player("hh_", "13-15");
    const asker = await player("ha_");
    const room = await partyRoom(host);
    const r = await asker.api("/api/v1/join-requests", { json: { code: room.code } });
    expect((await asker.api("/api/v1/join-requests")).data.requests).toEqual([]);
    expect((await host.api("/api/v1/join-requests")).data.requests.map((x: { id: string }) => x.id)).toContain(r.data.id);
    await admin().from("matches").update({ status: "finished" }).eq("id", room.matchId);
    expect((await host.api("/api/v1/join-requests")).data.requests).toEqual([]);
  });

  it("still refuses an answer from anyone but the host", async () => {
    const host = await player("hh_", "13-15");
    const asker = await player("ha_");
    const other = await player("ho_");
    const room = await partyRoom(host);
    const r = await asker.api("/api/v1/join-requests", { json: { code: room.code } });
    expect((await other.api(`/api/v1/join-requests/${r.data.id}`, { json: { decision: "approve" } })).status).toBe(403);
  });
});
