import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, guest, uniq, type Band } from "./helpers";
import { setSetting } from "./setup";

/**
 * R4-02: Board Bay invite codes from an under-16 host are friends only, like Party rooms (R2-13). The host's accepted
 * friends join with the code; anyone else gets 403 friends_only with a line saying to become friends first. Older
 * hosts are unaffected and the admin setting turns it off. Needs `supabase start` and the dev server (API_BASE).
 */
type G = Awaited<ReturnType<typeof guest>>;
const KEY = "rooms.under16FriendsOnly";

async function befriend(a: G, b: G) {
  const inv = await a.api("/api/v1/friends/invite");
  expect(inv.status).toBe(200);
  expect((await b.api("/api/v1/friends/invite/accept", { json: { code: inv.data.code } })).status).toBe(200);
}

async function bayInvite(host: G): Promise<{ id: string; inviteCode: string }> {
  const r = await host.api("/api/v1/bay", { json: { game: "fourup", mode: "async" } });
  expect(r.status).toBe(200);
  return r.data;
}

const join = (p: G, b: { id: string; inviteCode: string }) => p.api(`/api/v1/bay/${b.id}/join`, { json: { code: b.inviteCode } });
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

describe("api: friends-only Board Bay invites for under-16 hosts (R4-02)", () => {
  it("refuses a stranger with a clear message and seats nobody", async () => {
    const host = await player("bh_", "13-15");
    const stranger = await player("bs_");
    const b = await bayInvite(host);
    const r = await join(stranger, b);
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("friends_only");
    expect(r.data.message).toMatch(/friends only/i);
    const { data } = await admin().from("board_matches").select("players, status").eq("id", b.id).single();
    expect(data!.players).toHaveLength(1);
    expect(data!.status).toBe("waiting");
  });

  it("lets the host's friend in with the code", async () => {
    const host = await player("bh_", "13-15");
    const friend = await player("bf_", "13-15");
    await befriend(host, friend);
    const b = await bayInvite(host);
    const r = await join(friend, b);
    expect(r.status).toBe(200);
    expect(r.data.mySeat).toBe(1);
  });

  it("leaves a 16+ host's invite open to anyone with the code", async () => {
    const host = await player("bo_", "16-17");
    const stranger = await player("bs_");
    const b = await bayInvite(host);
    expect((await join(stranger, b)).status).toBe(200);
  });

  it("opens again when the admin setting is off", async () => {
    await setSetting(KEY, false);
    try {
      const host = await player("bh_", "13-15");
      const stranger = await player("bs_");
      const b = await bayInvite(host);
      expect((await join(stranger, b)).status).toBe(200);
    } finally {
      await setSetting(KEY, true);
    }
  });
});
