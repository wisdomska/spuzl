import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { LOGIC } from "@/games/logic-registry";
import type { Difficulty } from "@/games/types";
import { LEVELS as GOTCHA } from "@/games/gotcha/levels";
import { LEVELS as DASH } from "@/games/dash/levels";
import {
  isLadderGame,
  isLevel,
  ladderDone,
  isBossLevel,
  LEVEL_BLOCKS,
  levelCount,
  levelDifficulty,
  levelOpen,
  levelSeed,
  MAX_LEVEL,
  nextLevel,
  POOL_LADDERS,
  SEEDED_LADDERS,
} from "./levels";

const ORDER: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

describe("level ladders", () => {
  it("pool ladder sizes match the level pools, and every pool has at least 30 levels", () => {
    expect(POOL_LADDERS.gotcha).toBe(GOTCHA.length);
    expect(POOL_LADDERS.dash).toBe(DASH.length);
    for (const n of Object.values(POOL_LADDERS)) expect(n).toBeGreaterThanOrEqual(30);
  });

  it("pool ladders never put two rooms of the same kind in a row; Gotcha uses a kind at most twice, Dash once", async () => {
    const { motif } = await import("./rage-variety");
    const { HAND_LEVELS: GH, SET_PIECES: GS } = await import("@/games/gotcha/levels");
    const { HAND_LEVELS: DH, SET_PIECES: DS } = await import("@/games/dash/levels");
    for (const [pool, fixed] of [
      [GOTCHA, [...GH, ...GS]],
      [DASH, [...DH, ...DS]],
    ] as const) {
      const hand = new Set(fixed.map((l) => l.id));
      const kinds = pool.map(motif);
      for (let i = 1; i < kinds.length; i++) expect(kinds[i] === kinds[i - 1] && !hand.has(pool[i].id), pool[i].id).toBe(false);
      const counts = new Map<string, number>();
      pool.filter((l) => !hand.has(l.id)).forEach((l) => counts.set(motif(l), (counts.get(motif(l)) ?? 0) + 1));
      for (const [k, n] of counts) expect(n, k).toBeLessThanOrEqual(pool === DASH ? 1 : 2);
      // Dash: no look-alike levels at all, hand rooms and set pieces included
      if (pool === DASH) expect(new Set(kinds).size).toBe(kinds.length);
    }
  });

  it("knows which games have ladders", () => {
    for (const id of [...Object.keys(POOL_LADDERS), ...SEEDED_LADDERS]) {
      expect(isLadderGame(id), id).toBe(true);
      expect(LOGIC[id], id).toBeDefined();
    }
    expect(isLadderGame("chess")).toBe(false);
    expect(levelCount("gotcha")).toBe(GOTCHA.length);
    expect(levelCount("crownfall")).toBeNull();
  });

  it("climbs from easy to mega in waves, with a boss every fifth level", () => {
    expect(levelDifficulty(1)).toBe("easy");
    expect(levelDifficulty(5)).toBe("medium"); // the first boss
    expect(levelDifficulty(6)).toBe("medium");
    expect(levelDifficulty(8)).toBe("easy"); // a breather
    expect(levelDifficulty(10)).toBe("hard");
    expect(levelDifficulty(30)).toBe("mega");
    expect(levelDifficulty(61)).toBe("expert");
    expect(levelDifficulty(63)).toBe("hard");
    expect(levelDifficulty(66)).toBe("mega");
    expect(levelDifficulty(5000)).toBe("mega");
    // the base climbs, then expert and mega blocks take turns
    for (let i = 1; i < LEVEL_BLOCKS.length; i++) expect(LEVEL_BLOCKS[i]).toBeGreaterThanOrEqual(LEVEL_BLOCKS[i - 1] - 1);
    // every difficulty is used in the first 60 levels, bosses are the hardest of their block
    expect(new Set(Array.from({ length: 60 }, (_, i) => levelDifficulty(i + 1)))).toEqual(new Set(ORDER));
    for (let n = 5; n <= 200; n += 5) {
      expect(isBossLevel(n)).toBe(true);
      for (let k = n - 4; k < n; k++) expect(ORDER.indexOf(levelDifficulty(n))).toBeGreaterThanOrEqual(ORDER.indexOf(levelDifficulty(k)));
    }
    // after the first block, never four alike in a row
    for (let n = 8; n <= 200; n++) {
      const run = [n, n - 1, n - 2, n - 3].map(levelDifficulty);
      expect(new Set(run).size > 1, `${n}`).toBe(true);
    }
  });

  it("unlocks one level at a time and lets cleared levels replay", () => {
    // nothing cleared: only level 1
    expect(levelOpen("gotcha", 1, 0)).toBe(true);
    expect(levelOpen("gotcha", 2, 0)).toBe(false);
    // cleared up to 3: 1..4 open, 5 locked
    for (const n of [1, 2, 3, 4]) expect(levelOpen("gotcha", n, 3)).toBe(true);
    expect(levelOpen("gotcha", 5, 3)).toBe(false);
    // not a level
    expect(levelOpen("gotcha", 0, 3)).toBe(false);
    expect(levelOpen("gotcha", 1.5, 3)).toBe(false);
    expect(levelOpen("gotcha", GOTCHA.length + 1, GOTCHA.length)).toBe(false);
    expect(isLevel("crownfall", MAX_LEVEL)).toBe(true);
    expect(isLevel("crownfall", MAX_LEVEL + 1)).toBe(false);
    // next level, and the end of a finite ladder
    expect(nextLevel("gotcha", 0)).toBe(1);
    expect(nextLevel("gotcha", 11)).toBe(12);
    expect(nextLevel("gotcha", GOTCHA.length)).toBe(GOTCHA.length);
    expect(ladderDone("gotcha", GOTCHA.length)).toBe(true);
    expect(ladderDone("gotcha", 3)).toBe(false);
    expect(nextLevel("lost", 400)).toBe(401);
    expect(ladderDone("lost", 400)).toBe(false);
  });

  it("level seeds are per game and per level", () => {
    expect(levelSeed("lost", 12)).toBe("level:lost:12");
    expect(levelSeed("lost", 12)).not.toBe(levelSeed("lost", 13));
    expect(levelSeed("lost", 12)).not.toBe(levelSeed("dusk", 12));
  });

  it("seeded levels are deterministic, never carry the seed, and grow with the level where the game sizes boards", async () => {
    const sizeOf = (p: unknown): number => {
      const o = p as { size?: number; rows?: number; cols?: number; grid?: unknown[] };
      return o.size ?? (o.rows && o.cols ? o.rows * o.cols : Array.isArray(o.grid) ? o.grid.length : 0);
    };
    for (const id of SEEDED_LADDERS) {
      const logic = (await LOGIC[id]()).default;
      expect(logic.level, id).toBeUndefined();
      const at = (n: number) => logic.generate(createRng(levelSeed(id, n)), levelDifficulty(n));
      const a = at(7);
      expect(at(7), id).toEqual(a);
      expect(JSON.stringify(a.puzzle), id).not.toContain("level:");
      expect(at(8).puzzle, id).not.toEqual(a.puzzle);
      // level 40 (mega) is never a smaller board than level 1 (easy)
      expect(sizeOf(at(40).puzzle), id).toBeGreaterThanOrEqual(sizeOf(at(1).puzzle));
    }
    const crown = (await LOGIC.crownfall()).default;
    const s1 = (crown.generate(createRng(levelSeed("crownfall", 1)), levelDifficulty(1)).puzzle as { size: number }).size;
    const s40 = (crown.generate(createRng(levelSeed("crownfall", 40)), levelDifficulty(40)).puzzle as { size: number }).size;
    expect(s40).toBeGreaterThan(s1);
  });

  it("pool levels are one-room courses in ladder order that verify like any course", async () => {
    for (const [id, pool] of [
      ["gotcha", GOTCHA],
      ["dash", DASH],
    ] as const) {
      const logic = (await LOGIC[id]()).default;
      expect(logic.level, id).toBeDefined();
      expect(logic.level!(1)!.puzzle, id).toEqual({ levels: [pool[0].id] });
      expect(logic.level!(pool.length)!.puzzle, id).toEqual({ levels: [pool[pool.length - 1].id] });
      expect(logic.level!(0), id).toBeNull();
      expect(logic.level!(pool.length + 1), id).toBeNull();
      const g = logic.level!(12)!;
      expect(g.solution, id).toEqual(g.puzzle);
      expect(logic.progress(g.puzzle, g.solution, null), id).toBe(0);
    }
  });
});
