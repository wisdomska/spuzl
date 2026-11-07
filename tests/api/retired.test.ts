import { describe, expect, it } from "vitest";
import { BASE, guest, uniq } from "./helpers";
import { GAMES, MERGED_WORLDS, RETIRED_GAMES, WORLDS } from "@/lib/catalog";

/**
 * Retired games (lib/catalog RETIRED_IDS) through the real API: the code is still there, but every way in answers
 * like an unknown game, while the live games next to them keep working.
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/retired.test.ts
 */
const SAMPLE = ["blackout", "isles", "squint", "deadon", "sums", "hunch", "flip", "gauntlet"];

describe("api: retired games are refused like unknown ones", () => {
  it("covers a game from each kind of board", () => {
    for (const id of SAMPLE)
      expect(
        RETIRED_GAMES.some((g) => g.id === id),
        id,
      ).toBe(true);
  });

  it("refuses to start an attempt in any mode, or the guided first play", async () => {
    const g = await guest(uniq("ret_"));
    for (const game of SAMPLE) {
      for (const mode of ["daily", "free", "tutorial"] as const) {
        const r = await g.api("/api/v1/attempts", { json: { game, mode, difficulty: "easy" } });
        expect([game, mode, r.status, r.data?.error]).toEqual([game, mode, 404, "unknown_game"]);
      }
      const guided = await g.api(`/api/v1/guided/${game}`);
      expect([game, guided.status]).toEqual([game, 404]);
    }
    // A live game next to them still starts.
    expect((await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } })).status).toBe(200);
  });

  it("refuses guesses on a retired game's route", async () => {
    const g = await guest(uniq("retg_"));
    for (const game of ["hunch", "deadon", "squint"]) {
      const r = await g.api(`/api/games/${game}/guess`, { json: { ref: { game, t: "1.AAAA" }, guess: "CRANE" } });
      expect([game, r.status, r.data?.error]).toEqual([game, 404, "unknown_game"]);
    }
  });

  it("refuses ghost races, archives and leaderboards for retired games", async () => {
    const g = await guest(uniq("reto_"));
    expect((await g.api("/api/v1/ghosts/flipside", { json: {} })).status).toBe(404);
    expect((await g.api("/api/v1/ghosts/ghosted", { json: {} })).status).toBe(404);
    expect((await g.api("/api/v1/archive?game=hunch")).status).toBe(404);
    expect((await g.api("/api/v1/leaderboards/hunch")).status).toBe(404);
    expect((await g.api("/api/v1/leaderboards/crownfall")).status).toBe(200);
  });

  it("answers 404 on the play page, the bot page and an empty world", async () => {
    for (const path of ["/play/hunch", "/play/blackout?mode=free", "/play/flip/bot", "/world/number", "/ghost/flipside"]) {
      const r = await fetch(BASE + path, { redirect: "manual" });
      // Streamed pages (with a loading state) send 200 before notFound() runs; the body is the not-found page.
      const body = r.status === 404 ? "" : await r.text();
      expect([path, r.status === 404 || body.includes("This page could not be found")]).toEqual([path, true]);
    }
  });

  it("redirects the worlds folded in the regroup to their group, and keeps the 4 groups", async () => {
    for (const [from, to] of Object.entries(MERGED_WORLDS)) {
      const r = await fetch(`${BASE}/world/${from}`, { redirect: "manual" });
      expect([from, r.status, new URL(r.headers.get("location") ?? "", BASE).pathname]).toEqual([from, 308, `/world/${to}`]);
    }
    for (const w of WORLDS) {
      const r = await fetch(`${BASE}/world/${w.id}`, { redirect: "manual" });
      expect([w.id, r.status]).toEqual([w.id, 200]);
    }
  });

  it("serves only live games to players", async () => {
    const today = await fetch(`${BASE}/api/v1/today`).then((r) => r.json());
    expect(today.games.map((x: { id: string }) => x.id).sort()).toEqual(GAMES.map((x) => x.id).sort());
    const meta = await fetch(`${BASE}/api/v1/games/meta`).then((r) => r.json());
    // (Lab games are covered by tests/api/lab-flag.test.ts: they come back when "features.labGames" has them.)
    for (const g of RETIRED_GAMES) expect(meta[g.id], g.id).toBeUndefined();
  });
});
