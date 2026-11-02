import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { LOGIC } from "@/games/logic-registry";
import type { Difficulty } from "@/games/types";
import { LEVELS as GOTCHA } from "@/games/gotcha/levels";
import { LEVELS as DASH } from "@/games/dash/levels";
import { LEVELS as GAUNTLET } from "@/games/gauntlet/levels";
import {
  isLadderGame,
  isLevel,
  ladderDone,
  LEVEL_BANDS,
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
  it("pool ladder sizes match the level pools, and every pool has at least 60 levels", () => {
    expect(POOL_LADDERS.gotcha).toBe(GOTCHA.length);
    expect(POOL_LADDERS.dash).toBe(DASH.length);
    expect(POOL_LADDERS.gauntlet).toBe(GAUNTLET.length);
    for (const n of Object.values(POOL_LADDERS)) expect(n).toBeGreaterThanOrEqual(60);
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

  it("ramps difficulty from easy to mega and never eases off", () => {
    expect(levelDifficulty(1)).toBe("easy");
    expect(levelDifficulty(5)).toBe("easy");
    expect(levelDifficulty(6)).toBe("medium");
    expect(levelDifficulty(13)).toBe("hard");
    expect(levelDifficulty(23)).toBe("expert");
    expect(levelDifficulty(36)).toBe("mega");
    expect(levelDifficulty(5000)).toBe("mega");
    let prev = 0;
    for (let n = 1; n <= 200; n++) {
      const d = ORDER.indexOf(levelDifficulty(n));
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    // every band is used, in order, with a few levels each
    expect(LEVEL_BANDS.map((b) => b.difficulty)).toEqual(ORDER);
    for (let i = 1; i < LEVEL_BANDS.length; i++) expect(LEVEL_BANDS[i].from - LEVEL_BANDS[i - 1].from).toBeGreaterThanOrEqual(5);
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
      ["gauntlet", GAUNTLET],
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
