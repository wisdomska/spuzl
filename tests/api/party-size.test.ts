import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
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
});
