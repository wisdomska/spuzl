import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, BASE, SB_URL, admin, birthFor, guest, uniq, type Band } from "./helpers";
import { setSetting } from "./setup";

/**
 * Age from birth month and year (owner request): set once at sign-up, band derived on the server, locked for the
 * player (409 age_locked), under 13 refused with nothing kept, players from before add theirs once, and the gates
 * (Quick Match, friends by name, 18+ party) follow the derived band.
 * Run: API_BASE=http://localhost:3203 pnpm vitest run -c vitest.api.config.mts tests/api/age.test.ts
 */

type Caller = Awaited<ReturnType<typeof guest>>["api"];

/** A signed-in email account (not a guest), optionally with a profile in the band. */
async function member(band?: Band): Promise<{ userId: string; api: Caller }> {
  const email = `${uniq("age")}@age.test`;
  const password = randomBytes(18).toString("base64url");
  const { data: created, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const sb = createClient(SB_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e2 } = await sb.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const token = s.session!.access_token;
  const api: Caller = async (path, init = {}) => {
    const res = await fetch(BASE + path, {
      ...init,
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };
  if (band) {
    const p = await api("/api/v1/profile", { json: { nickname: uniq("ag_"), ...birthFor(band), color: "#2FD3E0" } });
    if (p.status !== 200) throw new Error(`profile: ${p.status} ${JSON.stringify(p.data)}`);
  }
  return { userId: created.user.id, api };
}

const row = async (id: string) =>
  (await admin().from("players").select("age_band, birth_year, birth_month").eq("id", id).maybeSingle()).data;

describe("age: set once at sign-up", () => {
  it("creates a profile from birth month and year and derives the band", async () => {
    const g = await guest();
    const b = birthFor("16-17");
    const r = await g.api("/api/v1/profile", { json: { nickname: uniq("a1_"), ...b, color: "#2FD3E0" } });
    expect(r.status).toBe(200);
    expect(r.data.ageBand).toBe("16-17");
    expect(await row(g.userId)).toEqual({ age_band: "16-17", birth_year: b.birthYear, birth_month: b.birthMonth });
    const me = await g.api("/api/v1/me");
    expect(me.data.age_band).toBe("16-17");
    expect(me.data.birthSet).toBe(true);
    // The birth date itself never comes back to the client.
    expect(me.data).not.toHaveProperty("birth_year");
    expect(me.data).not.toHaveProperty("birth_month");
  });

  it("ignores a chosen band: the server derives it", async () => {
    const g = await guest();
    const r = await g.api("/api/v1/profile", { json: { nickname: uniq("a2_"), ...birthFor("13-15"), ageBand: "18+", color: "#2FD3E0" } });
    expect(r.status).toBe(200);
    expect((await row(g.userId))?.age_band).toBe("13-15");
  });

  it("needs birth month and year to create a profile, and refuses the future", async () => {
    const g = await guest();
    const none = await g.api("/api/v1/profile", { json: { nickname: uniq("a3_"), ageBand: "18+", color: "#2FD3E0" } });
    expect([none.status, none.data.error]).toEqual([422, "birth_required"]);
    const y = new Date().getUTCFullYear();
    const future = await g.api("/api/v1/profile", { json: { nickname: uniq("a3_"), birthYear: y + 1, birthMonth: 1, color: "#2FD3E0" } });
    expect([future.status, future.data.error]).toEqual([422, "birth_invalid"]);
    expect(await row(g.userId)).toBeNull();
  });

  it("refuses under 13 and keeps nothing", async () => {
    const g = await guest();
    const y = new Date().getUTCFullYear();
    const r = await g.api("/api/v1/profile", { json: { nickname: uniq("a4_"), birthYear: y - 10, birthMonth: 1, color: "#2FD3E0" } });
    expect([r.status, r.data.error]).toEqual([403, "too_young"]);
    expect(await row(g.userId)).toBeNull();
    expect((await g.api("/api/v1/me?optional=1")).data).toBeNull();
  });

  it("locks birth month and year: a change is refused with 409 age_locked, the same one is fine", async () => {
    const g = await guest();
    const b = birthFor("13-15");
    const nickname = uniq("a5_");
    await g.api("/api/v1/profile", { json: { nickname, ...b, color: "#2FD3E0" } });
    const again = await g.api("/api/v1/profile", { json: { nickname, ...b, color: "#FF8A3D" } });
    expect(again.status).toBe(200);
    const older = await g.api("/api/v1/profile", { json: { nickname, ...birthFor("18+"), color: "#2FD3E0" } });
    expect([older.status, older.data.error]).toEqual([409, "age_locked"]);
    const band = await g.api("/api/v1/profile", { json: { nickname, ageBand: "18+", color: "#2FD3E0" } });
    expect([band.status, band.data.error]).toEqual([409, "age_locked"]);
    for (const json of [{ birthYear: 1990, birthMonth: 1 }, { ageBand: "18+" }, { age_band: "18+" }]) {
      const p = await g.api("/api/v1/profile", { method: "PATCH", json });
      expect([p.status, p.data.error]).toEqual([409, "age_locked"]);
    }
    expect(await row(g.userId)).toEqual({ age_band: "13-15", birth_year: b.birthYear, birth_month: b.birthMonth });
  });
});

describe("age: players from before birth month and year were asked", () => {
  /** A profile as it was made before: a chosen band, no birth month and year, joined a while ago. */
  async function legacy(band: Band) {
    const g = await guest();
    const joined = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const { error } = await admin()
      .from("players")
      .insert({ id: g.userId, nickname: uniq("lg_"), age_band: band, created_at: joined, is_guest: true });
    if (error) throw error;
    return g;
  }

  it("keeps their band working and asks once", async () => {
    const g = await legacy("16-17");
    const me = await g.api("/api/v1/me");
    expect(me.status).toBe(200);
    expect(me.data.age_band).toBe("16-17");
    expect(me.data.birthSet).toBe(false);
  });

  it("takes a birth month and year that fits the band they chose, once", async () => {
    const g = await legacy("18+");
    const b = birthFor("18+");
    expect((await g.api("/api/v1/profile", { json: b })).status).toBe(200);
    expect(await row(g.userId)).toEqual({ age_band: "18+", birth_year: b.birthYear, birth_month: b.birthMonth });
    const change = await g.api("/api/v1/profile", { json: { birthYear: b.birthYear - 1, birthMonth: 1 } });
    expect([change.status, change.data.error]).toEqual([409, "age_locked"]);
  });

  it("accepts a younger band (more careful rules) but not an older one", async () => {
    const adult = await legacy("18+");
    expect((await adult.api("/api/v1/profile", { json: birthFor("13-15") })).status).toBe(200);
    expect((await row(adult.userId))?.age_band).toBe("13-15");
    const teen = await legacy("13-15");
    const r = await teen.api("/api/v1/profile", { json: { birthYear: new Date().getUTCFullYear() - 40, birthMonth: 1 } });
    expect([r.status, r.data.error]).toEqual([409, "age_locked"]);
    expect(await row(teen.userId)).toEqual({ age_band: "13-15", birth_year: null, birth_month: null });
  });

  it("refuses under 13 without touching the profile (nobody is locked out)", async () => {
    const g = await legacy("13-15");
    const r = await g.api("/api/v1/profile", { json: { birthYear: new Date().getUTCFullYear() - 9, birthMonth: 1 } });
    expect([r.status, r.data.error]).toEqual([403, "too_young"]);
    expect(await row(g.userId)).toEqual({ age_band: "13-15", birth_year: null, birth_month: null });
    expect((await g.api("/api/v1/me")).status).toBe(200);
  });
});

describe("age: the gates follow the derived band", () => {
  let before: unknown = undefined;
  beforeAll(async () => {
    const { data } = await admin().from("game_settings").select("value").eq("key", "features.adultParty").maybeSingle();
    before = data?.value;
    await setSetting("features.adultParty", true);
  }, 60_000);
  afterAll(async () => {
    if (before === undefined) await admin().from("game_settings").delete().eq("key", "features.adultParty");
    else await setSetting("features.adultParty", before);
  });

  /** Moves a player's birth month and year the only way it can move: the admin correction path (service role). */
  const correct = async (id: string, band: Band) => {
    const b = birthFor(band);
    const { error } = await admin().rpc("svc_admin_set_birth", {
      p_player: id,
      p_actor: null,
      p_year: b.birthYear,
      p_month: b.birthMonth,
      p_reason: "api test",
    });
    if (error) throw error;
  };

  it("under 16: no Quick Match, no friend requests by name; both open when the band moves to 16 to 17", async () => {
    const adult = await guest(uniq("gt_"));
    const kid = await member("13-15");
    const nick = (await admin().from("players").select("nickname").eq("id", adult.userId).single()).data!.nickname;
    expect((await kid.api("/api/v1/duel/queue", { json: {} })).status).toBe(403);
    expect((await kid.api("/api/v1/friends", { json: { nickname: nick } })).data.error).toBe("invite_only");
    await correct(kid.userId, "16-17");
    expect((await kid.api("/api/v1/me")).data.age_band).toBe("16-17");
    expect((await kid.api("/api/v1/duel/queue", { json: {} })).status).not.toBe(403);
    expect((await kid.api("/api/v1/friends", { json: { nickname: nick } })).status).toBe(200);
  });

  it("18+ party opens only when the derived band is 18+", async () => {
    const teen = await member("16-17");
    const draw = { mode: "draw", maxPlayers: 4, adultNotice: true };
    const r = await teen.api("/api/v1/rooms", { json: draw });
    expect([r.status, r.data.error]).toEqual([403, "adults_only"]);
    await correct(teen.userId, "18+");
    expect((await teen.api("/api/v1/rooms", { json: draw })).status).toBe(200);
  });

  it("a stored 18+ band written behind the API's back does not open adult rooms for a 15-year-old", async () => {
    const kid = await member("13-15");
    // The trigger derives the band again from birth month and year, so this write changes nothing.
    await admin().from("players").update({ age_band: "18+" }).eq("id", kid.userId);
    expect((await row(kid.userId))?.age_band).toBe("13-15");
    const r = await kid.api("/api/v1/rooms", { json: { mode: "draw", maxPlayers: 4, adultNotice: true } });
    expect(r.data.error).toBe("adults_only");
  });
});

describe("age: export and deletion", () => {
  it("exports birth month and year, and deleting the account removes them", async () => {
    const nickname = uniq("ex_");
    const g = await guest(nickname);
    const b = birthFor("18+");
    const res = await fetch(`${BASE}/api/v1/account/export`, { headers: { authorization: `Bearer ${g.token}` } });
    const doc = await res.json();
    expect(doc.player).toMatchObject({ birth_year: b.birthYear, birth_month: b.birthMonth, age_band: "18+" });
    const del = await g.api("/api/v1/account", { method: "DELETE", json: { confirm: nickname } });
    expect(del.status).toBe(200);
    expect(await row(g.userId)).toBeNull();
  });
});
