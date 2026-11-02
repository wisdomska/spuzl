import { solve as solveCrown, type CrownfallPuzzle } from "@/games/crownfall/logic";
import { describe, expect, it } from "vitest";
import { admin, guest } from "./helpers";
import { createSim } from "@/games/gotcha/logic";
import { CONFIG, LEVELS } from "@/games/gotcha/levels";
import SOLUTIONS from "@/games/gotcha/solutions.json";
import { replay } from "@/phaser/sim/core";
import { framesToMs } from "@/phaser/sim/fixed";
import { courseLog } from "@/phaser/sim/scripted";

/**
 * Level ladders through the real API: levels unlock one at a time (level n + 2 can't start before n + 1 is
 * cleared), cleared levels replay (without a second reward), the seed never reaches the client, and progress is
 * kept per account. Gotcha's pool ladder is played with the bot's recorded solutions.
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/levels.test.ts
 */
type G = Awaited<ReturnType<typeof guest>>;

/** A no-death run of `id`: the bot's recorded solution, exactly as the game's own replay tests play it. */
function runFor(id: string) {
  const log = courseLog([id], SOLUTIONS, CONFIG.levelPause);
  const r = replay(createSim({ levels: [id] }), log);
  expect(r.ok).toBe(true);
  return { state: { log, deaths: r.deaths, timeMs: framesToMs(log.frames) }, ms: framesToMs(log.frames) };
}

async function clear(g: G, n: number) {
  const s = await g.api("/api/v1/attempts", { json: { game: "gotcha", mode: "level", level: n } });
  expect(s.status, JSON.stringify(s.data)).toBe(200);
  expect(s.data.level).toBe(n);
  expect(s.data.puzzle.levels).toEqual([LEVELS[n - 1].id]);
  const { state, ms } = runFor(LEVELS[n - 1].id);
  await new Promise((r) => setTimeout(r, Math.max(0, ms - 2500)));
  const f = await g.api(`/api/v1/attempts/${s.data.attemptId}/finish`, { json: { state, activeMs: ms, mistakes: 0, deaths: 0 } });
  expect(f.status, JSON.stringify(f.data)).toBe(200);
  return f.data;
}

/**
 * Clears Crownfall level n like an honest player: solve the served board, then finish after a human-paced wait
 * (the bot-recorded Rage Ridge runs are faster than the human floor, so the server rightly flags them).
 */
async function clearCrown(g: G, n: number) {
  const s = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "level", level: n } });
  expect(s.status, JSON.stringify(s.data)).toBe(200);
  expect(s.data.level).toBe(n);
  const puzzle = s.data.puzzle as CrownfallPuzzle;
  const sol = solveCrown(puzzle)!;
  const state = new Array(puzzle.size * puzzle.size).fill(0);
  sol.forEach((c, r) => (state[r * puzzle.size + c] = 2));
  await new Promise((r) => setTimeout(r, 6200));
  const f = await g.api(`/api/v1/attempts/${s.data.attemptId}/finish`, { json: { state, activeMs: 6000, mistakes: 0 } });
  expect(f.status, JSON.stringify(f.data)).toBe(200);
  return f.data;
}

describe("level ladders", () => {
  it("unlocks one level at a time, replays cleared levels and keeps the seed on the server", async () => {
    const g = await guest(`lvl${Math.random().toString(36).slice(2, 7)}`);

    // Nothing cleared: level 1 is next, level 2 is locked.
    const none = await g.api("/api/v1/levels?game=gotcha");
    expect(none.data).toMatchObject({ top: 0, next: 1, levels: LEVELS.length, cleared: [] });
    expect((await g.api("/api/v1/attempts", { json: { game: "gotcha", mode: "level", level: 2 } })).status).toBe(403);

    // Without a level the server starts the next one. No seed in the answer.
    const auto = await g.api("/api/v1/attempts", { json: { game: "gotcha", mode: "level" } });
    expect(auto.status).toBe(200);
    expect(auto.data.level).toBe(1);
    expect(auto.data).not.toHaveProperty("seed");
    expect(JSON.stringify(auto.data)).not.toContain("level:gotcha");
    const { data: att } = await admin().from("attempts").select("mode, free_seed").eq("id", auto.data.attemptId).single();
    expect(att).toMatchObject({ mode: "level", free_seed: expect.stringMatching(/^level:gotcha:1:[0-9a-f]{24}\|/) });

    // Climb Crownfall: clearing level 1 opens level 2; level 3 stays locked until 2 is cleared.
    expect((await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "level", level: 2 } })).status).toBe(403);
    const first = await clearCrown(g, 1);
    expect(first.ok).toBe(true);
    expect(first.ladder).toMatchObject({ level: 1, top: 1, next: 2 });
    expect((await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "level", level: 3 } })).status).toBe(403);
    const second = await clearCrown(g, 2);
    expect(second.ladder).toMatchObject({ level: 2, top: 2, next: 3 });

    // Replays are allowed, and earn nothing the second time.
    const again = await clearCrown(g, 1);
    expect(again.ok).toBe(true);
    expect(again.reward.xp).toBe(0);
    expect(again.ladder).toMatchObject({ level: 1, top: 2 });

    const mine = await g.api("/api/v1/levels?game=crownfall");
    expect(mine.data).toMatchObject({ top: 2, next: 3 });
    expect(mine.data.cleared.map((c: { level: number }) => c.level)).toEqual([1, 2]);
    const all = await g.api("/api/v1/levels");
    expect(all.data.games.crownfall).toMatchObject({ top: 2, next: 3, levels: null });
    expect(all.data.games.gotcha).toMatchObject({ top: 0, next: 1 });

    // A Rage Ridge level is one room: a fast, re-simulated clean run counts and opens the next level.
    const rage = await clear(g, 1);
    expect(rage.ok).toBe(true);
    expect(rage.ladder).toMatchObject({ level: 1, top: 1, next: 2 });

    // Players can read their own rows, never write them.
    const { error } = await g.sb.from("player_levels").insert({ player_id: g.userId, game_id: "gotcha", level: 9, best_ms: 1 });
    expect(error).not.toBeNull();
  }, 120_000);

  it("refuses levels for games without a ladder and levels past the end", async () => {
    const g = await guest(`lvl${Math.random().toString(36).slice(2, 7)}`);
    expect((await g.api("/api/v1/attempts", { json: { game: "chess", mode: "level", level: 1 } })).status).toBe(404);
    expect((await g.api("/api/v1/attempts", { json: { game: "gotcha", mode: "level", level: LEVELS.length + 1 } })).status).toBe(404);
    expect((await g.api("/api/v1/levels?game=chess")).status).toBe(404);
  });

  it("serves a seeded game's level as the same board for everyone", async () => {
    const a = await guest(`lvl${Math.random().toString(36).slice(2, 7)}`);
    const b = await guest(`lvl${Math.random().toString(36).slice(2, 7)}`);
    const sa = await a.api("/api/v1/attempts", { json: { game: "crownfall", mode: "level", level: 1 } });
    const sb = await b.api("/api/v1/attempts", { json: { game: "crownfall", mode: "level", level: 1 } });
    expect(sa.status).toBe(200);
    expect(sa.data.puzzle).toEqual(sb.data.puzzle);
    expect((await a.api("/api/v1/attempts", { json: { game: "crownfall", mode: "level", level: 2 } })).status).toBe(403);
  });
});
