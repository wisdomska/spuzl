import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, admin, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { LAB_GAMES } from "@/lib/catalog";

/**
 * R2-P5: lab games through the real API, behind "features.labGames" (a set of game ids). A lab game whose id is not
 * in the set answers like an unknown game everywhere a player can reach it (attempts in every mode, the practice
 * round, the guess route, archive, leaderboards, the play and bot pages); one in the set plays like a live game.
 * Needs a server reading settings without a cache (development, or SETTINGS_CACHE_MS=0).
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/lab-flag.test.ts
 */
const KEY = "features.labGames";
let before: unknown = undefined;
beforeAll(async () => {
  const { data } = await admin().from("game_settings").select("value").eq("key", KEY).maybeSingle();
  before = data?.value;
});
afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", KEY);
  else await setSetting(KEY, before);
});

const notFound = async (path: string) => {
  const r = await fetch(BASE + path, { redirect: "manual" });
  // Streamed pages (with a loading state) send 200 before notFound() runs; the body is the not-found page.
  const body = r.status === 404 ? "" : await r.text();
  return r.status === 404 || body.includes("This page could not be found");
};

describe("api: lab games behind features.labGames", () => {
  it("switched off: every lab game is refused like an unknown game", async () => {
    await setSetting(KEY, []);
    const g = await guest(uniq("laboff_"));
    for (const { id } of LAB_GAMES) {
      for (const mode of ["daily", "free", "tutorial"] as const) {
        const r = await g.api("/api/v1/attempts", { json: { game: id, mode, difficulty: "easy" } });
        expect([id, mode, r.status, r.data?.error]).toEqual([id, mode, 404, "unknown_game"]);
      }
      expect([id, (await g.api(`/api/v1/guided/${id}`)).status]).toEqual([id, 404]);
    }
    // The guess route answers before it reads the token.
    const guess = await g.api("/api/games/five/guess", { json: { ref: { game: "five", t: "1.AAAA" }, guess: "CRANE" } });
    expect([guess.status, guess.data?.error]).toEqual([404, "unknown_game"]);
    expect((await g.api("/api/v1/archive?game=pixl")).status).toBe(404);
    expect((await g.api("/api/v1/leaderboards/pixl")).status).toBe(404);
    for (const path of ["/play/five?mode=free", "/play/dara/bot"]) expect([path, await notFound(path)]).toEqual([path, true]);
  });

  it("switched on per game: only the listed games open", async () => {
    await setSetting(KEY, ["hilo", "dara"]);
    const g = await guest(uniq("labon_"));
    expect((await g.api("/api/v1/attempts", { json: { game: "hilo", mode: "free", difficulty: "easy" } })).status).toBe(200);
    expect((await g.api("/api/v1/guided/hilo")).status).toBe(200);
    expect((await g.api("/api/v1/leaderboards/hilo")).status).toBe(200);
    expect(await notFound("/play/dara/bot")).toBe(false);
    // Not listed: still refused.
    expect((await g.api("/api/v1/attempts", { json: { game: "pixl", mode: "free", difficulty: "easy" } })).status).toBe(404);
    expect((await g.api("/api/v1/guided/pixl")).status).toBe(404);
    // The public settings carry the set, so the Library and worlds show the same games.
    const pub = await fetch(`${BASE}/api/v1/settings/game`).then((r) => r.json());
    expect(pub[KEY]).toEqual(["hilo", "dara"]);
    // (Duels and Parties never race a lab game, on or off: lib/catalog.test.ts, RACE_GAMES is live games only.)
  });
});
