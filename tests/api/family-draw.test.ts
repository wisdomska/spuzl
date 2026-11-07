import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, BASE, SB_URL, admin, birthFor, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { FAMILY_DRAW_WORDS } from "@/lib/party-adult/family";

/**
 * R2-P5 part B: Family Draw (party mode "drawfam"), Draw It for signed-in players aged 16 and over, through the real
 * API. The admin switch "party.familyDraw"; the 16+ gate on create, card, join, view and every action (guests and
 * under-16s refused); preset words and four options; picks only (typed guesses refused), once each; drawings
 * reported through the same snapshot path as the 18+ rooms.
 * Needs `supabase start`, migration 20261205005401 and the dev server (API_BASE).
 * Run: API_BASE=http://localhost:3000 pnpm vitest run -c vitest.api.config.mts tests/api/family-draw.test.ts
 */
type Caller = Awaited<ReturnType<typeof guest>>["api"];
interface Player {
  userId: string;
  api: Caller;
}

/** A signed-in email account (not an anonymous guest) with a profile in the given age band. */
async function member(ageBand: "13-15" | "16-17" | "18+"): Promise<Player> {
  const email = `${uniq("fam")}@family.test`;
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
  const p = await api("/api/v1/profile", { json: { nickname: uniq("fd_"), ...birthFor(ageBand), color: "#2FD3E0" } });
  if (p.status !== 200) throw new Error(`profile: ${p.status} ${JSON.stringify(p.data)}`);
  return { userId: created.user.id, api };
}

const KEY = "party.familyDraw";
const fam = { mode: "drawfam", maxPlayers: 4 };
let before: unknown = undefined;

beforeAll(async () => {
  const { data } = await admin().from("game_settings").select("value").eq("key", KEY).maybeSingle();
  before = data?.value;
  await setSetting(KEY, true);
}, 60_000);

afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", KEY);
  else await setSetting(KEY, before);
});

describe("Family Draw: who may create, see and join", () => {
  it("is off by default and refused while off", async () => {
    const a = await member("16-17");
    await setSetting(KEY, false);
    try {
      const r = await a.api("/api/v1/rooms", { json: fam });
      expect([r.status, r.data.error]).toEqual([403, "family_draw_off"]);
    } finally {
      await setSetting(KEY, true);
    }
  });

  it("refuses guests and under-16s; a 16-17 host opens a room without the adults-only notice", async () => {
    const g = await guest(uniq("fdg_"));
    expect((await g.api("/api/v1/rooms", { json: fam })).data.error).toBe("family_signed_in");
    const kid = await member("13-15");
    const k = await kid.api("/api/v1/rooms", { json: fam });
    expect([k.status, k.data.error]).toEqual([403, "family_16_plus"]);
    const host = await member("16-17");
    const ok = await host.api("/api/v1/rooms", { json: fam });
    expect(ok.status).toBe(200);
    // An under-16 can't see the room card or join it.
    expect((await kid.api(`/api/v1/rooms/${ok.data.code}`)).status).toBe(403);
    expect((await kid.api(`/api/v1/rooms/${ok.data.code}/join`, { json: {} })).status).toBe(403);
    // A 16+ player can; the card says what it is.
    const adult = await member("18+");
    const card = await adult.api(`/api/v1/rooms/${ok.data.code}`);
    expect([card.status, card.data.room.mode]).toEqual([200, "drawfam"]);
  });
});

describe("Family Draw: a round", () => {
  it("draws a preset word, offers four options, takes one pick each (no typing) and reports drawings", async () => {
    const host = await member("16-17");
    const guesser = await member("18+");
    const { data } = await host.api("/api/v1/rooms", { json: fam });
    const code = data.code as string;
    const matchId = data.matchId as string;
    expect((await guesser.api(`/api/v1/rooms/${code}/join`, { json: {} })).status).toBe(200);
    expect((await guesser.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } })).status).toBe(200);
    expect((await host.api(`/api/v1/rooms/${code}/start`, { json: {} })).status).toBe(200);
    await new Promise((r) => setTimeout(r, 5000)); // countdown and head start

    const hv = (await host.api(`/api/v1/matches/${matchId}`)).data;
    const gv = (await guesser.api(`/api/v1/matches/${matchId}`)).data;
    expect(hv.mode).toBe("drawfam");
    const word = hv.party.word as string;
    expect(FAMILY_DRAW_WORDS.some((w) => w.word === word)).toBe(true);
    expect(gv.party.word).toBeNull();
    expect(gv.party.options).toHaveLength(4);
    expect(gv.party.options).toContain(word);

    // The drawer draws strokes as in Draw It.
    const stroke = { c: 0, w: 1, p: [100, 100, 500, 500, 900, 100] };
    expect((await host.api(`/api/v1/rooms/${code}/party/draw`, { json: { round: 1, op: "add", strokes: [stroke] } })).status).toBe(200);

    // Typing is refused in these rooms; picks only, once each, never by the drawer.
    expect((await guesser.api(`/api/v1/rooms/${code}/party/guess`, { json: { round: 1, text: word } })).status).toBe(409);
    expect((await host.api(`/api/v1/rooms/${code}/party/pick`, { json: { round: 1, pick: 0 } })).status).toBe(403);
    expect((await guesser.api(`/api/v1/rooms/${code}/party/pick`, { json: { round: 1, pick: 4 } })).status).toBe(400);
    const right = (gv.party.options as string[]).indexOf(word);
    // Report the drawing before the round closes (the pick ends it: everyone has picked).
    expect((await guesser.api(`/api/v1/rooms/${code}/party/report`, { json: { round: 1, kind: "drawing", reason: "other" } })).status).toBe(
      200,
    );
    const pick = await guesser.api(`/api/v1/rooms/${code}/party/pick`, { json: { round: 1, pick: right } });
    expect([pick.status, pick.data.result]).toEqual([200, "correct"]);
    const again = await guesser.api(`/api/v1/rooms/${code}/party/pick`, { json: { round: 1, pick: right } });
    expect(again.status).toBe(409);
    const after = (await guesser.api(`/api/v1/matches/${matchId}`)).data.party;
    expect(after.phase).toBe("reveal");
    expect(after.word).toBe(word);

    // The report holds the server's snapshot: strokes and the word, marked as a 16+ room.
    const { data: reports } = await admin()
      .from("reports")
      .select("snapshot, target_id")
      .eq("target_type", "party")
      .eq("target_id", host.userId);
    expect(reports?.[0]?.snapshot).toMatchObject({ kind: "drawing", mode: "draw", room: "drawfam", word, strokes: [stroke] });
    // No typed text is stored for the round.
    const { data: g } = await admin().from("party_guesses").select("text, pick").eq("match_id", matchId);
    expect(g?.every((x) => x.text === null && x.pick !== null)).toBe(true);
  });
});
