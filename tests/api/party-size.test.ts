import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ANON, BASE, SB_URL, admin, birthFor, guest, uniq } from "./helpers";
import { setSetting } from "./setup";

/** Owner, 11 Nov 2026: a Party room holds up to 10, and new rooms never go past the admin's limit (party.maxPlayers). */
const KEY = "party.maxPlayers";
let before: unknown;
beforeAll(async () => {
  before = (await admin().from("game_settings").select("value").eq("key", KEY).maybeSingle()).data?.value;
});
afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", KEY);
  else await setSetting(KEY, before);
});

describe("api: party size", () => {
  it("opens a room of 10 that fills and then refuses the 11th", async () => {
    await setSetting(KEY, 10);
    const host = await guest(uniq("roomhost"));
    const r = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 10 } });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    const code = r.data.code as string;
    for (let i = 0; i < 9; i++) {
      const p = await guest(uniq("racer"));
      expect((await p.api(`/api/v1/rooms/${code}/join`, { json: {} })).status).toBe(200);
    }
    const late = await guest(uniq("latecomer"));
    const full = await late.api(`/api/v1/rooms/${code}/join`, { json: {} });
    expect(full.status).toBe(409);
    expect(full.data.error).toBe("room_full");
    expect((await host.api(`/api/v1/rooms/${code}`)).data.view.maxPlayers).toBe(10);
  });

  it("caps a new room at the admin's limit", async () => {
    await setSetting(KEY, 6);
    const host = await guest(uniq("capper"));
    const r = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 10 } });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect((await host.api(`/api/v1/rooms/${r.data.code}`)).data.view.maxPlayers).toBe(6);
  });

  it("refuses more than 10 whatever the setting", async () => {
    const host = await guest(uniq("toomany"));
    const r = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 11 } });
    expect(r.status).toBe(400);
  });

  it("caps Draw It rooms at the turn-game limit (8 by default)", async () => {
    await setSetting(KEY, 10);
    const adultBefore = (await admin().from("game_settings").select("value").eq("key", "features.adultParty").maybeSingle()).data?.value;
    await setSetting("features.adultParty", true);
    // 18+ party games need a signed-in account: a temporary one, deleted below whatever happens.
    const email = `${uniq("drawhost")}@adult.test`;
    const password = randomBytes(18).toString("base64url");
    const { data: made, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    try {
      const sb = createClient(SB_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
      const token = (await sb.auth.signInWithPassword({ email, password })).data.session!.access_token;
      const call = async (path: string, json?: unknown) => {
        const res = await fetch(BASE + path, {
          method: json === undefined ? "GET" : "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: json === undefined ? undefined : JSON.stringify(json),
        });
        return { status: res.status, data: await res.json() };
      };
      expect((await call("/api/v1/profile", { nickname: uniq("drawhost"), ...birthFor("18+"), color: "#2FD3E0" })).status).toBe(200);
      const r = await call("/api/v1/rooms", { mode: "draw", maxPlayers: 10, adultNotice: true });
      expect(r.status, JSON.stringify(r.data)).toBe(200);
      expect((await call(`/api/v1/rooms/${r.data.code}`)).data.view.maxPlayers).toBe(8);
    } finally {
      await admin().auth.admin.deleteUser(made.user.id);
      if (adultBefore === undefined) await admin().from("game_settings").delete().eq("key", "features.adultParty");
      else await setSetting("features.adultParty", adultBefore);
    }
  });
});
