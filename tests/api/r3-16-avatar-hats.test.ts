import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";

/**
 * R3-16: list avatars are small Spuz chips wearing each player's Shop look, so every list payload that feeds
 * one carries `hat` next to `color`: friends, add-by-username search, the feed, blocks, leaderboards, leagues,
 * crews and chat. Hat and colour are public cosmetics (shown on profiles too); nothing else new is exposed.
 * Needs `supabase start` and the dev server (API_BASE).
 */
type G = Awaited<ReturnType<typeof guest>>;
const today = () => new Date().toISOString().slice(0, 10);

/** Gives the guest Sparks, buys a hat and wears it, through the real Shop API. */
async function wear(p: G, itemId: string) {
  await admin().from("players").update({ sparks: 2000 }).eq("id", p.userId);
  expect((await p.api("/api/v1/shop/buy", { json: { itemId, requestId: randomUUID() } })).status).toBe(200);
  expect((await p.api("/api/v1/shop/equip", { json: { itemId, equip: true } })).status).toBe(200);
}

async function befriend(a: G, b: G) {
  const inv = await a.api("/api/v1/friends/invite");
  expect((await b.api("/api/v1/friends/invite/accept", { json: { code: inv.data.code } })).status).toBe(200);
}

/** Keys a list row must never carry alongside the look. */
const PRIVATE_KEYS = ["avatar_color", "age_band", "birth_year", "birth_month", "email", "sparks", "country", "city"];
const clean = (row: object) => expect(Object.keys(row).filter((k) => PRIVATE_KEYS.includes(k))).toEqual([]);

describe("api: list rows carry the Spuz hat (R3-16)", () => {
  it("friends, search, feed and blocks", async () => {
    const aName = uniq("ha_");
    const bName = uniq("hb_");
    const a = await guest(aName);
    const b = await guest(bName);
    await wear(b, "hat-shades");
    await befriend(a, b);

    const friends = await a.api("/api/v1/friends");
    const f = friends.data.friends.find((x: { id: string }) => x.id === b.userId);
    expect(f).toMatchObject({ hat: "shades" });
    expect(typeof f.color).toBe("string");
    clean(f);
    // the other side: a wears nothing, so null (never missing)
    const back = (await b.api("/api/v1/friends")).data.friends.find((x: { id: string }) => x.id === a.userId);
    expect(back.hat).toBeNull();

    const c = await guest(uniq("hc_"));
    const hit = (await c.api(`/api/v1/players/search?q=${bName}`)).data.players.find((x: { id: string }) => x.id === b.userId);
    expect(hit).toMatchObject({ hat: "shades" });
    clean(hit);

    const { data: ev } = await admin()
      .from("feed_events")
      .insert({ player_id: b.userId, kind: "clear", game_id: "crownfall", payload: { timeMs: 65000, hints: 0 } })
      .select("id")
      .single();
    const item = (await a.api("/api/v1/feed")).data.items.find((i: { id: number }) => i.id === ev!.id);
    expect(item.player).toMatchObject({ id: b.userId, hat: "shades", me: false });
    expect(Object.keys(item.player).sort()).toEqual(["color", "hat", "id", "me", "nickname"]);

    expect((await c.api("/api/v1/blocks", { json: { playerId: b.userId } })).status).toBe(200);
    const blocked = (await c.api("/api/v1/blocks")).data.blocked;
    expect(blocked).toEqual([{ id: b.userId, nickname: expect.any(String), color: expect.any(String), hat: "shades" }]);
  });

  it("leaderboard rows (and your pinned row) carry hat", async () => {
    const a = await guest(uniq("hl_"));
    const b = await guest(uniq("hm_"));
    await wear(a, "hat-crown");
    await befriend(a, b);
    const d = today();
    const now = new Date().toISOString();
    await admin()
      .from("daily_results")
      .insert([
        { date: d, game_id: "dusk", player_id: a.userId, time_ms: 70_000, finished_at: now },
        { date: d, game_id: "dusk", player_id: b.userId, time_ms: 50_000, finished_at: now },
      ]);
    const r = await a.api(`/api/v1/leaderboards/dusk?scope=friends&date=${d}`);
    expect(r.status).toBe(200);
    const hats = Object.fromEntries(r.data.rows.map((x: { id: string; hat: string | null }) => [x.id, x.hat]));
    expect(hats).toEqual({ [a.userId]: "crown", [b.userId]: null });
    expect(r.data.me).toMatchObject({ me: true, hat: "crown" });
  });

  it("league and crew tables carry hat", async () => {
    const a = await guest(uniq("hg_"));
    await wear(a, "hat-kente");
    await admin()
      .from("daily_results")
      .insert({ date: today(), game_id: "crownfall", player_id: a.userId, time_ms: 60_000, finished_at: new Date().toISOString() });
    const league = await a.api("/api/v1/leagues/current");
    const mine = league.data.league.members.find((m: { me: boolean }) => m.me);
    expect(mine).toMatchObject({ id: a.userId, hat: "kente" });
    for (const m of league.data.league.members) expect(m).toHaveProperty("hat");

    const crew = await a.api("/api/v1/crews", { json: { name: uniq("Hat Crew ") } });
    expect(crew.status).toBe(200);
    const page = await a.api(`/api/v1/crews/${crew.data.id}`);
    expect(page.data.carry.find((r: { id: string }) => r.id === a.userId)).toMatchObject({ hat: "kente", me: true });
    clean(page.data.carry[0]);
  });

  it("chat messages carry the sender's hat", async () => {
    const a = await guest(uniq("hx_"));
    const b = await guest(uniq("hy_"));
    await wear(a, "hat-headphones");
    const m = await a.api("/api/v1/bay", { json: { game: "fourup", mode: "live" } });
    await b.api(`/api/v1/bay/${m.data.id}/join`, { json: { code: m.data.inviteCode } });
    expect((await a.api(`/api/v1/bay/${m.data.id}/chat`, { json: { quick: 0 } })).status).toBe(200);
    expect((await b.api(`/api/v1/bay/${m.data.id}/chat`, { json: { quick: 1 } })).status).toBe(200);
    const seen = (await b.api(`/api/v1/bay/${m.data.id}/chat`)).data.messages;
    expect(seen.map((x: { from: string; hat: string | null }) => [x.from, x.hat])).toEqual([
      [a.userId, "headphones"],
      [b.userId, null],
    ]);
    for (const x of seen) clean(x);
  });
});
