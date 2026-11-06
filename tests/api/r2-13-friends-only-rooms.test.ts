import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, guest, uniq, type Band } from "./helpers";
import { adminSession, type AdminSession } from "./admin-helpers";
import { setSetting } from "./setup";

/**
 * R2-13: friends-only rooms for under-16 hosts, through the real API. Party rooms and friend duels hosted by a
 * 13 to 15 player let in only the host's accepted friends; anyone else asks, and the host approves or declines.
 * Older hosts are unaffected, the admin setting turns it off, and the join-approval log is moderator-only with an
 * audited CSV export. Needs `supabase start` and the dev server (API_BASE) reading settings without a cache.
 */
type G = Awaited<ReturnType<typeof guest>>;
const KEY = "rooms.under16FriendsOnly";

async function befriend(a: G, b: G) {
  const inv = await a.api("/api/v1/friends/invite");
  expect(inv.status).toBe(200);
  expect((await b.api("/api/v1/friends/invite/accept", { json: { code: inv.data.code } })).status).toBe(200);
}

async function partyRoom(host: G): Promise<{ code: string; matchId: string }> {
  const r = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 4 } });
  expect(r.status).toBe(200);
  return r.data;
}

async function friendDuel(host: G): Promise<{ code: string; matchId: string }> {
  const r = await host.api("/api/v1/duel/friend", { json: {} });
  expect(r.status).toBe(200);
  return r.data;
}

const joinParty = (p: G, code: string) => p.api(`/api/v1/rooms/${code}/join`, { json: {} });
const joinDuel = (p: G, code: string) => p.api("/api/v1/duel/friend/join", { json: { code } });
const ask = (p: G, code: string) => p.api("/api/v1/join-requests", { json: { code } });
const pending = (host: G, matchId: string) => host.api(`/api/v1/join-requests?match=${matchId}`);
const decide = (host: G, id: string, decision: "approve" | "decline") => host.api(`/api/v1/join-requests/${id}`, { json: { decision } });
const player = (prefix: string, band: Band = "18+") => guest(uniq(prefix), band);

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

describe("api: friends-only Party rooms for under-16 hosts (R2-13)", () => {
  it("blocks a non-friend with a clear message, and the preview says to ask", async () => {
    const host = await player("fh_", "13-15");
    const stranger = await player("fs_");
    const { code } = await partyRoom(host);
    const r = await joinParty(stranger, code);
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("friends_only");
    expect(r.data.message).toMatch(/friends only/i);
    const preview = await stranger.api(`/api/v1/rooms/${code}`);
    expect(preview.data).toMatchObject({ member: false, room: { friendsOnly: true, request: null } });
  });

  it("lets the host's accepted friends straight in", async () => {
    const host = await player("fh_", "13-15");
    const friend = await player("ff_");
    await befriend(host, friend);
    const { code, matchId } = await partyRoom(host);
    expect((await friend.api(`/api/v1/rooms/${code}`)).data.room.friendsOnly).toBe(false);
    const r = await joinParty(friend, code);
    expect(r.status).toBe(200);
    expect(r.data.matchId).toBe(matchId);
    expect((await ask(friend, code)).data.status).toBe("not_needed");
  });

  it("request, host approves in the lobby, then the asker joins", async () => {
    const host = await player("fh_", "13-15");
    const asker = await player("fa_");
    const { code, matchId } = await partyRoom(host);
    const req = await ask(asker, code);
    expect(req.status).toBe(200);
    expect(req.data).toMatchObject({ status: "pending" });
    // Idempotent: asking again hands back the same request.
    expect((await ask(asker, code)).data.id).toBe(req.data.id);

    const list = await pending(host, matchId);
    expect(list.status).toBe(200);
    expect(list.data.requests).toEqual([expect.objectContaining({ id: req.data.id, nickname: expect.any(String) })]);
    // Only the host sees or answers them.
    expect((await pending(asker, matchId)).status).toBe(403);
    expect((await decide(asker, req.data.id, "approve")).status).toBe(403);
    // The asker reads their own request; nobody else can.
    expect((await asker.api(`/api/v1/join-requests/${req.data.id}`)).data.status).toBe("pending");
    expect((await host.api(`/api/v1/join-requests/${req.data.id}`)).status).toBe(404);

    expect((await joinParty(asker, code)).status).toBe(403);
    expect((await decide(host, req.data.id, "approve")).data.status).toBe("approved");
    expect((await asker.api(`/api/v1/join-requests/${req.data.id}`)).data.status).toBe("approved");
    expect((await joinParty(asker, code)).status).toBe(200);
    expect((await pending(host, matchId)).data.requests).toEqual([]);

    const { data: row } = await admin().from("room_join_requests").select("*").eq("id", req.data.id).single();
    expect(row).toMatchObject({
      room_kind: "party",
      room_code: code,
      host_id: host.userId,
      requester_id: asker.userId,
      status: "approved",
    });
    expect(row.decided_at).not.toBeNull();
  });

  it("decline: the asker is not let in and cannot ask again for that room", async () => {
    const host = await player("fh_", "13-15");
    const asker = await player("fd_");
    const { code } = await partyRoom(host);
    const req = await ask(asker, code);
    expect((await decide(host, req.data.id, "decline")).data.status).toBe("declined");
    expect((await joinParty(asker, code)).status).toBe(403);
    expect((await asker.api(`/api/v1/join-requests/${req.data.id}`)).data.status).toBe("declined");
    const again = await ask(asker, code);
    expect(again.status).toBe(403);
    expect(again.data.error).toBe("declined");
  });

  it("a blocked pair gets no request at all", async () => {
    const host = await player("fh_", "13-15");
    const blocked = await player("fb_");
    await admin().from("blocks").insert({ player_id: host.userId, blocked_id: blocked.userId });
    const { code } = await partyRoom(host);
    const r = await ask(blocked, code);
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("friends_only");
  });

  it("16+ hosts are unaffected", async () => {
    for (const band of ["16-17", "18+"] as const) {
      const host = await player("fo_", band);
      const stranger = await player("fx_");
      const { code } = await partyRoom(host);
      expect((await ask(stranger, code)).data.status).toBe("not_needed");
      expect((await joinParty(stranger, code)).status).toBe(200);
    }
  });

  it("the admin setting turns it off at runtime", async () => {
    const host = await player("fh_", "13-15");
    const stranger = await player("fy_");
    const { code } = await partyRoom(host);
    await setSetting(KEY, false);
    try {
      expect((await joinParty(stranger, code)).status).toBe(200);
    } finally {
      await setSetting(KEY, true);
    }
  });
});

describe("api: friends-only friend duels for under-16 hosts (R2-13)", () => {
  it("blocks a non-friend on the duel code join, and lets them in once the host approves", async () => {
    const host = await player("dh_", "13-15");
    const asker = await player("da_");
    const { code, matchId } = await friendDuel(host);
    const blocked = await joinDuel(asker, code);
    expect(blocked.status).toBe(403);
    expect(blocked.data.error).toBe("friends_only");
    const req = await ask(asker, code);
    expect(req.data.status).toBe("pending");
    expect((await pending(host, matchId)).data.requests).toHaveLength(1);
    expect((await decide(host, req.data.id, "approve")).data.status).toBe("approved");
    const joined = await joinDuel(asker, code);
    expect(joined.status).toBe(200);
    expect(joined.data.matchId).toBe(matchId);
    const { data: m } = await admin().from("matches").select("status").eq("id", matchId).single();
    expect(m?.status).toBe("playing");
  });

  it("friends join a duel straight away; declined askers don't", async () => {
    const host = await player("dh_", "13-15");
    const friend = await player("df_");
    await befriend(host, friend);
    expect((await joinDuel(friend, (await friendDuel(host)).code)).status).toBe(200);

    const host2 = await player("dh_", "13-15");
    const asker = await player("dn_");
    const { code } = await friendDuel(host2);
    const req = await ask(asker, code);
    await decide(host2, req.data.id, "decline");
    expect((await joinDuel(asker, code)).status).toBe(403);
  });

  it("16+ duel hosts are unaffected", async () => {
    const host = await player("do_", "16-17");
    const stranger = await player("dz_");
    expect((await joinDuel(stranger, (await friendDuel(host)).code)).status).toBe(200);
  });
});

describe("api: join-approval log in the admin console (R2-13)", () => {
  let mod: AdminSession;
  let analyst: AdminSession;
  beforeAll(async () => {
    mod = await adminSession("moderator");
    analyst = await adminSession("analyst");
  });

  it("moderators read and filter the log, export it as audited CSV; analysts can't", async () => {
    const host = await player("lh_", "13-15");
    const asker = await player("la_");
    const { code } = await partyRoom(host);
    const req = await ask(asker, code);
    await decide(host, req.data.id, "decline");

    const list = await mod.aal2(`/api/admin/join-requests?q=${code}&status=declined`);
    expect(list.status).toBe(200);
    expect(list.data.rows).toEqual([
      expect.objectContaining({ id: req.data.id, room_code: code, status: "declined", room_kind: "party", host_id: host.userId }),
    ]);
    expect(list.data.rows[0].requester).toEqual(expect.any(String));
    expect(Object.keys(list.data.rows[0]).sort()).toEqual(
      ["created_at", "decided_at", "host", "host_id", "id", "requester", "requester_id", "room_code", "room_kind", "status"].sort(),
    );
    expect((await mod.aal2("/api/admin/join-requests?status=maybe")).status).toBe(400);
    expect((await mod.aal2("/api/admin/join-requests?q=a,b")).status).toBe(400);

    const csv = await mod.aal2("/api/admin/join-requests", { json: { q: code } });
    expect(csv.status).toBe(200);
    expect(csv.data.csv.split("\r\n")[0]).toBe("asked_at_gmt,requester,requester_id,host,host_id,room,code,outcome,decided_at_gmt");
    expect(csv.data.csv).toContain(`,party,${code},declined,`);
    const { data: log } = await admin()
      .from("audit_log")
      .select("action, target, detail")
      .eq("actor_id", mod.userId)
      .eq("action", "joinlog.export")
      .order("id", { ascending: false })
      .limit(1);
    expect(log?.[0]).toMatchObject({ target: "join_requests", detail: expect.objectContaining({ q: code, rows: 1, role: "moderator" }) });

    expect((await analyst.aal2("/api/admin/join-requests")).data.error).toBe("forbidden");
    expect((await analyst.aal2("/api/admin/join-requests", { json: {} })).data.error).toBe("forbidden");
  });

  it("changing the setting is an audited admin action", async () => {
    const owner = await adminSession("owner");
    const r = await owner.aal2("/api/admin/settings", { method: "PUT", json: { key: KEY, value: true } });
    expect(r.status).toBe(200);
    const { data } = await admin()
      .from("audit_log")
      .select("target")
      .eq("actor_id", owner.userId)
      .eq("action", "setting.update")
      .order("id", { ascending: false })
      .limit(1);
    expect(data?.[0]?.target).toBe(`setting:${KEY}`);
  });
});
