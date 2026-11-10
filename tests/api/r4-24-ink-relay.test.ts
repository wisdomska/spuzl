import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, BASE, SB_URL, admin, birthFor, guest, uniq } from "./helpers";
import { setSetting } from "./setup";

/**
 * R4-24: Draw It live ink goes through the server. Only the drawer of a drawing round gets an ink pass in its
 * round view; POST /api/v1/ink relays a batch only with the caller's own pass and a valid batch, and stamps the
 * sender itself (players can't publish on the ink channel: supabase/tests/184_ink_channel.test.sql).
 * Run: API_BASE=http://localhost:3000 pnpm vitest run -c vitest.api.config.mts tests/api/r4-24-ink-relay.test.ts
 */
type Caller = Awaited<ReturnType<typeof guest>>["api"];

async function member(): Promise<{ userId: string; api: Caller }> {
  const email = `${uniq("ink")}@adult.test`;
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
  const p = await api("/api/v1/profile", { json: { nickname: uniq("ink_"), ...birthFor("18+"), color: "#2FD3E0" } });
  if (p.status !== 200) throw new Error(`profile: ${p.status} ${JSON.stringify(p.data)}`);
  return { userId: created.user.id, api };
}

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

describe("api: Draw It live ink relay (R4-24)", () => {
  it("gives the pass to the drawer only and relays only the drawer's own, valid batches", async () => {
    const host = await member();
    const guesser = await member();
    const { data } = await host.api("/api/v1/rooms", { json: { mode: "draw", maxPlayers: 4, adultNotice: true } });
    const code = data.code as string;
    const matchId = data.matchId as string;
    expect((await guesser.api(`/api/v1/rooms/${code}/join`, { json: {} })).status).toBe(200);
    expect((await guesser.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } })).status).toBe(200);
    expect((await host.api(`/api/v1/rooms/${code}/start`, { json: {} })).status).toBe(200);
    await new Promise((r) => setTimeout(r, 5000)); // countdown and the head start

    const hv = (await host.api(`/api/v1/matches/${matchId}`)).data;
    const gv = (await guesser.api(`/api/v1/matches/${matchId}`)).data;
    expect(hv.party.leadId).toBe(host.userId);
    expect(hv.party.phase).toBe("play");
    const pass = hv.party.inkPass as string;
    expect(pass).toEqual(expect.any(String));
    expect(gv.party.inkPass).toBeNull();

    const batch = { s: 1, c: 0, w: 1, i: 0, p: [100, 100, 5, 5] };
    expect((await host.api("/api/v1/ink", { json: { pass, ...batch } })).status).toBe(200);
    expect((await host.api("/api/v1/ink", { json: { pass, ...batch, i: 2, p: [], e: 1 } })).status).toBe(200);
    // Someone else's pass, a forged one, no pass, or a bad batch: refused.
    expect((await guesser.api("/api/v1/ink", { json: { pass, ...batch } })).status).toBe(403);
    expect((await guesser.api("/api/v1/ink", { json: { pass: `${pass}x`, ...batch } })).status).toBe(403);
    expect((await guesser.api("/api/v1/ink", { json: batch })).status).toBe(400);
    expect((await host.api("/api/v1/ink", { json: { pass, ...batch, p: [990, 10, 20, 0] } })).status).toBe(400);
    expect((await host.api("/api/v1/ink", { json: { pass, ...batch, c: 99 } })).status).toBe(400);
  }, 60_000);
});
