import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, admin, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { LAB_GAMES } from "@/lib/catalog";

/**
 * R2-P5: lab games through the real API, behind "features.labGames" (a set of game ids). A lab game whose id is not
 * in the set answers like an unknown game everywhere a player can reach it (attempts in every mode, the practice
 * round, the guess route, archive, leaderboards, the play and bot pages); one in the set plays like a live game.
 * The twelve R2-P5 lab games graduated on 11 Nov 2026, so none is in testing now: the switched-off check covers the
 * next one, and the twelve are checked as live games that open whatever the setting holds.
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
  // Streamed pages (with a loading state) send 200 before notFound() runs; only a real not-found carries the 404
  // digest (every page embeds the not-found boundary text, so the text alone proves nothing).
  const body = r.status === 404 ? "" : await r.text();
  return r.status === 404 || body.includes("NEXT_HTTP_ERROR_FALLBACK;404");
};

/** The twelve R2-P5 lab games, live since 11 Nov 2026 (migration 20261211300101). */
const GRADUATED = ["five", "hilo", "penalty", "market", "lightup", "killer", "dara", "pinned", "flagged", "tripwire", "pixl", "twotruths"];

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
  });

  it("graduated: the twelve open with the setting empty, like any live game", { timeout: 90_000 }, async () => {
    await setSetting(KEY, []);
    const g = await guest(uniq("labgrad_"));
    for (const id of GRADUATED) {
      const r = await g.api("/api/v1/attempts", { json: { game: id, mode: "free", difficulty: "easy" } });
      expect([id, r.status]).toEqual([id, 200]);
      expect([id, (await g.api(`/api/v1/guided/${id}`)).status]).toEqual([id, 200]);
    }
    // The guess route reads the token now (a forged one is a bad ref, not an unknown game).
    const guess = await g.api("/api/games/five/guess", { json: { ref: { game: "five", t: "1.AAAA" }, guess: "CRANE" } });
    expect(guess.data?.error).not.toBe("unknown_game");
    // Archive and leaderboards may be off with Dailies; either way they never answer "unknown game" for them.
    expect((await g.api("/api/v1/archive?game=pixl")).data?.error).not.toBe("unknown_game");
    expect((await g.api("/api/v1/leaderboards/pixl")).data?.error).not.toBe("unknown_game");
    for (const path of ["/play/five?mode=free", "/play/dara/bot"]) expect([path, await notFound(path)]).toEqual([path, false]);
  });

  it("a value stored before the graduation still names the twelve: ignored, and the games stay open", async () => {
    await setSetting(KEY, GRADUATED);
    const pub = await fetch(`${BASE}/api/v1/settings/game`).then((r) => r.json());
    expect(pub[KEY]).toEqual([]);
    const g = await guest(uniq("labstale_"));
    expect((await g.api("/api/v1/attempts", { json: { game: "hilo", mode: "free", difficulty: "easy" } })).status).toBe(200);
    // (Duels and Parties race the graduated time games now: lib/catalog.test.ts and lib/multiplayer/scoreRace.test.ts.)
  });
});
