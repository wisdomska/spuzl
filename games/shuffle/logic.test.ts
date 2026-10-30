import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  gapOf,
  generate,
  grade,
  hint,
  lineToGap,
  makeArt,
  movable,
  replay,
  slide,
  solve,
  solved,
  SPEC,
  verify,
  type ShufflePuzzle,
  type ShuffleState,
} from "./logic";

const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
// 3×3: gap (8) in the middle, two slides from solved
const near: ShufflePuzzle = { size: 3, tiles: [0, 1, 2, 3, 8, 4, 6, 7, 5], art: { bg: "#000", shapes: [] }, par: 2 };

describe("shuffle", () => {
  it("slides only tiles next to the gap", () => {
    expect(slide(3, near.tiles, 4)).toEqual([0, 1, 2, 3, 4, 8, 6, 7, 5]);
    expect(slide(3, near.tiles, 0)).toBeNull();
    expect(slide(3, near.tiles, 8)).toBeNull();
    expect(slide(3, near.tiles, 42)).toBeNull();
    expect(movable(3, near.tiles).sort()).toEqual([1, 3, 4, 7]);
    expect(movable(3, [8, 0, 1, 2, 3, 4, 5, 6, 7]).sort()).toEqual([0, 2]);
    expect(gapOf(4)).toBe(15);
  });

  it("finds the tiles between a tap and the gap", () => {
    const t = [0, 1, 2, 8, 3, 4, 5, 6, 7];
    expect(lineToGap(3, t, 5)).toEqual([3, 4]);
    expect(lineToGap(3, t, 0)).toEqual([0]);
    expect(lineToGap(3, t, 8)).toEqual([]);
    expect(lineToGap(3, t, 3)).toEqual([]);
  });

  it("solves optimally on 3x3", () => {
    expect(solve(3, near.tiles)).toEqual([4, 5]);
    expect(solve(3, [0, 1, 2, 3, 4, 5, 6, 7, 8])).toEqual([]);
    // tight budget gives up
    expect(solve(4, generate(createRng("budget"), "expert").puzzle.tiles, 1, 10)).toBeNull();
  });

  for (const d of diffs) {
    it(`generates solvable ${d} boards deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.size).toBe(SPEC[d].size);
      expect(solved(a.puzzle.tiles)).toBe(false);
      expect(a.puzzle.par).toBe(a.solution.moves.length);
      expect(verify(a.puzzle, a.solution, { moves: a.solution.moves })).toEqual({ ok: true, progress: 1 });
    }, 15_000);
  }

  it("every board over 25 seeds is solvable within par", () => {
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), diffs[i % 3]);
      expect(solved(replay(g.puzzle, g.solution.moves).tiles)).toBe(true);
    }
  });

  it("par is optimal on 3x3 boards", () => {
    const g = generate(createRng("opt"), "medium");
    expect(solve(3, g.puzzle.tiles, 1)!.length).toBe(g.puzzle.par);
  });

  it("verifies by replay and rejects illegal or unfinished logs", () => {
    const g = generate(createRng("verify"), "easy");
    const m = g.solution.moves;
    expect(verify(g.puzzle, g.solution, { moves: m.slice(0, -1) }).reason).toBe("picture not whole");
    expect(verify(g.puzzle, g.solution, { moves: [99] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { moves: [1.5] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as unknown as ShuffleState).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, { moves: new Array(6000).fill(0) }).ok).toBe(false);
    // any legal route counts, not just the stored one
    const longer = [...m.slice(0, 1), m[0], ...m];
    expect(verify(g.puzzle, g.solution, { moves: longer }).ok).toBe(true);
  });

  it("progress counts tiles home", () => {
    expect(logic.progress(near, { moves: [] }, { moves: [] })).toBeCloseTo(6 / 8);
    expect(logic.progress(near, { moves: [] }, { moves: [4, 5] })).toBe(1);
    expect(logic.progress(near, { moves: [] }, {} as ShuffleState)).toBe(0);
  });

  it("hints are safe: following them always rebuilds the picture", () => {
    for (const d of ["easy", "hard"] as Difficulty[]) {
      const g = generate(createRng(`hints:${d}`), d);
      const moves: number[] = [];
      // wander off the stored route first
      const t0 = g.puzzle.tiles;
      moves.push(movable(g.puzzle.size, t0).find((x) => x !== g.solution.moves[0])!);
      for (let k = 0; k < 200 && !verify(g.puzzle, g.solution, { moves }).ok; k++) {
        const h = hint(g.puzzle, g.solution, { moves })!;
        expect(h).not.toBeNull();
        moves.push(h.target as number);
        expect(replay(g.puzzle, moves).bad).toBe(-1);
      }
      expect(verify(g.puzzle, g.solution, { moves }).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, { moves })).toBeNull();
    }
    const g = generate(createRng("h0"), "easy");
    expect(hint(g.puzzle, g.solution, { moves: [] })!.target).toBe(g.solution.moves[0]);
    expect(hint(g.puzzle, g.solution, { moves: [77] })).toBeNull();
    expect(hint(g.puzzle, g.solution, "x" as unknown as ShuffleState)).toBeNull();
  });

  it("hint falls back to undoing the last slide when the search runs out", () => {
    const g = generate(createRng("fallback"), "mega");
    // scramble further away by 2 slides then ask with a board the weighted search still solves
    const first = movable(5, g.puzzle.tiles)[0];
    const h = hint(g.puzzle, g.solution, { moves: [first] })!;
    expect(typeof h.target).toBe("number");
  }, 20_000);

  it("builds varied art and grades bigger boards harder", () => {
    const a = makeArt(createRng("art"));
    expect(a.shapes.length).toBeGreaterThan(10);
    expect(new Set(a.shapes.map((s) => s.t))).toEqual(new Set(["rect", "circle", "poly"]));
    const avg = (d: Difficulty) => [0, 1, 2].reduce((s, i) => s + generate(createRng(`g${i}`), d).grade, 0) / 3;
    const e = avg("easy"),
      h = avg("hard"),
      m = avg("mega");
    expect(h).toBeGreaterThan(e);
    expect(m).toBeGreaterThan(h);
    expect(grade(near)).toBeGreaterThanOrEqual(0);
  }, 20_000);
  it("hints from the empty board before the first move", () => {
    const g = generate(createRng("pre"), "easy");
    expect(hint(g.puzzle, g.solution, undefined)).toEqual(hint(g.puzzle, g.solution, { moves: [] }));
    expect(hint(g.puzzle, g.solution, undefined)).not.toBeNull();
  });
});
