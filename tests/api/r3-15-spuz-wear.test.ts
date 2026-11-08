import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";

/**
 * R3-15: a player's Shop look (skin colour and hat) shows wherever their Spuz does, for them and for the people
 * they play. Match and Board Bay views carry each seat's `hat` next to its `color`; nothing else new is exposed.
 * Needs `supabase start` and the dev server (API_BASE).
 */
type G = Awaited<ReturnType<typeof guest>>;

/** Gives the guest Sparks, buys a hat and wears it, through the real Shop API. */
async function wear(p: G, itemId: string) {
  await admin().from("players").update({ sparks: 2000 }).eq("id", p.userId);
  expect((await p.api("/api/v1/shop/buy", { json: { itemId, requestId: randomUUID() } })).status).toBe(200);
  expect((await p.api("/api/v1/shop/equip", { json: { itemId, equip: true } })).status).toBe(200);
}

/** Profile fields that must never ride along with the look on a seat (only `color` and `hat` are public). */
const PRIVATE_KEYS = ["skin", "avatar_color", "title", "age_band", "birth_year", "birth_month", "email", "sparks", "players"];

describe("api: the Spuz look travels (R3-15)", () => {
  it("the profile carries the equipped hat for MySpuz", async () => {
    const a = await guest(uniq("sw_"));
    expect((await a.api("/api/v1/me")).data.hat).toBeNull();
    await wear(a, "hat-shades");
    const me = await a.api("/api/v1/me");
    expect(me.data.hat).toBe("shades");
    expect(typeof me.data.avatar_color).toBe("string");
  });

  it("a Duel's seats carry each player's hat (null for none), and nothing private", async () => {
    const a = await guest(uniq("swa_"));
    const b = await guest(uniq("swb_"));
    await wear(a, "hat-crown");
    expect((await a.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } })).status).toBe(200);
    const qb = await b.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } });
    expect(qb.data.status).toBe("matched");
    for (const viewer of [a, b]) {
      const v = await viewer.api(`/api/v1/matches/${qb.data.matchId}`);
      expect(v.status).toBe(200);
      const seat = (id: string) => v.data.players.find((p: { id: string }) => p.id === id);
      expect(seat(a.userId).hat).toBe("crown");
      expect(seat(b.userId).hat).toBeNull();
      for (const p of v.data.players) expect(Object.keys(p).filter((k) => PRIVATE_KEYS.includes(k))).toEqual([]);
    }
  });

  it("a Board Bay invite shows the host's hat to the invited player; the bot wears none", async () => {
    const host = await guest(uniq("swh_"));
    await wear(host, "hat-kente");
    const inv = await host.api("/api/v1/bay", { json: { game: "oware", mode: "async" } });
    const friend = await guest(uniq("swf_"));
    const v = await friend.api(`/api/v1/bay/${inv.data.id}`);
    expect(v.status).toBe(200);
    expect(v.data.mySeat).toBeNull();
    expect(v.data.players[0]).toMatchObject({ id: host.userId, hat: "kente" });
    expect(Object.keys(v.data.players[0]).sort()).toEqual(["color", "hat", "id", "nickname", "rating", "seat"]);

    const bot = await host.api("/api/v1/bay", { json: { game: "fourup", mode: "async", bot: true } });
    const bv = await host.api(`/api/v1/bay/${bot.data.id}`);
    const hats = Object.fromEntries(bv.data.players.map((p: { id: string; hat: string | null }) => [p.id, p.hat]));
    expect(hats[host.userId]).toBe("kente");
    expect(
      Object.entries(hats)
        .filter(([id]) => id !== host.userId)
        .map(([, h]) => h),
    ).toEqual([null]);
  });
});
