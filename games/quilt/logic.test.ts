import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  analyze,
  area,
  candidates,
  countSolutions,
  generate,
  grade,
  hint,
  nextDeduction,
  rectBreak,
  rectCells,
  SIZE_FOR,
  solve,
  spanRect,
  verify,
  type QuiltPuzzle,
  type Rect,
} from "./logic";

// 3×3 hand puzzle: [3 . .] / [. . 2] / [4 . .]  → top row (3), right column rows 1-2 (2), bottom-left 2×2 (4)
const tiny: QuiltPuzzle = {
  rows: 3,
  cols: 3,
  clues: [
    [0, 3],
    [5, 2],
    [6, 4],
  ],
};

describe("quilt", () => {
  it("analyses rectangles: missing number, two numbers, wrong area", () => {
    expect(rectBreak(tiny, [1, 0, 1, 1])).toBe("none");
    expect(rectBreak(tiny, [0, 0, 2, 3])).toBe("many");
    expect(rectBreak(tiny, [0, 0, 1, 2])).toBe("area");
    expect(rectBreak(tiny, [0, 0, 1, 3])).toBeNull();
    const a = analyze(tiny, [[0, 0, 1, 2]]);
    expect(a.message).toBe("The area must match the number.");
    expect(a.clear).toBe(false);
    expect(
      analyze(tiny, [
        [0, 0, 1, 3],
        [1, 2, 2, 1],
        [1, 0, 2, 2],
      ]).clear,
    ).toBe(true);
    // overlap is never clear even with correct areas
    expect(
      analyze(tiny, [
        [0, 0, 1, 3],
        [1, 2, 2, 1],
        [1, 0, 2, 2],
        [1, 0, 2, 2],
      ]).clear,
    ).toBe(false);
  });

  it("geometry helpers", () => {
    expect(spanRect(5, 12, 0)).toEqual([0, 0, 3, 3]);
    expect(rectCells({ cols: 3 }, [1, 1, 2, 2])).toEqual([4, 5, 7, 8]);
    expect(area([0, 0, 2, 3])).toBe(6);
    expect(candidates(tiny)[0]).toContainEqual([0, 0, 1, 3]);
  });

  it("solves the hand puzzle uniquely", () => {
    expect(countSolutions(tiny, 5)).toBe(1);
    expect(solve(tiny)).toEqual([
      [0, 0, 1, 3],
      [1, 2, 2, 1],
      [1, 0, 2, 2],
    ]);
    expect(solve(tiny, [[0, 0, 1, 1]])).toBeNull();
    expect(
      solve(tiny, [
        [0, 0, 1, 3],
        [0, 0, 1, 3],
      ]),
    ).toBeNull();
    expect(
      countSolutions(
        {
          rows: 2,
          cols: 2,
          clues: [
            [0, 2],
            [3, 2],
          ],
        },
        5,
      ),
    ).toBe(2);
  });

  const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
  for (const d of diffs) {
    it(`generates unique ${d} puzzles deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.rows).toBe(SIZE_FOR[d]);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(solve(a.puzzle)).toEqual(a.solution);
      expect(a.solution.reduce((s, r) => s + area(r), 0)).toBe(a.puzzle.rows * a.puzzle.cols);
    });
  }

  it("generates 25 unique boards across seeds", () => {
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), i % 2 ? "medium" : "easy");
      expect(countSolutions(g.puzzle, 2)).toBe(1);
    }
  });

  it("verifies the solution and rejects near misses and malformed input", () => {
    const g = generate(createRng("verify"), "easy");
    const shuffled = [...g.solution].reverse();
    expect(verify(g.puzzle, g.solution, shuffled)).toEqual({ ok: true, progress: 1 });
    expect(verify(g.puzzle, g.solution, g.solution.slice(1)).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, [...g.solution, g.solution[0]]).reason).toBe("overlap");
    expect(verify(g.puzzle, g.solution, [[0, 0, 0, 1]] as Rect[]).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, [[0, 0, 99, 1]] as Rect[]).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, "nope" as unknown as Rect[]).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, [[0, 0.5, 1, 1]] as Rect[]).ok).toBe(false);
    // tampered secret: a valid board that differs from the stored answer is refused
    const fake = g.solution.map((r) => [...r] as Rect);
    expect(verify(g.puzzle, [[0, 0, 1, 1], ...fake.slice(1)], g.solution).ok).toBe(false);
  });

  it("progress counts only correct rectangles", () => {
    const g = generate(createRng("progress"), "easy");
    const n = g.puzzle.rows * g.puzzle.cols;
    expect(logic.progress(g.puzzle, g.solution, [g.solution[0]])).toBeCloseTo(area(g.solution[0]) / n);
    expect(logic.progress(g.puzzle, g.solution, [[0, 0, 1, 1]])).toBeLessThanOrEqual(
      g.solution.some((r) => r.join() === "0,0,1,1") ? 1 / n : 0,
    );
    expect(logic.progress(g.puzzle, g.solution, null as unknown as Rect[])).toBe(0);
  });

  it("hints are safe: following them always reaches the solution", () => {
    for (const seed of ["hints", "hints2", "hints3"]) {
      const g = generate(createRng(seed), "hard");
      const wrong: Rect = g.solution.some((r) => r.join() === "0,0,1,1") ? [0, 0, 1, 2] : [0, 0, 1, 1];
      let state: Rect[] = [wrong];
      let h = hint(g.puzzle, g.solution, state);
      expect(h?.target).toEqual(wrong);
      state = [];
      for (let k = 0; k < 200 && !verify(g.puzzle, g.solution, state).ok; k++) {
        h = hint(g.puzzle, g.solution, state);
        expect(h).not.toBeNull();
        const r = h!.target as Rect;
        expect(g.solution).toContainEqual(r);
        state = [...state, r];
      }
      expect(verify(g.puzzle, g.solution, state).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, state)).toBeNull();
    }
    expect(hint(tiny, [], "x" as unknown as Rect[])).toBeNull();
  });

  it("deductions never contradict the solution", () => {
    for (const d of diffs) {
      const g = generate(createRng(`deduce:${d}`), d);
      const placed: Rect[] = [];
      for (;;) {
        const x = nextDeduction(g.puzzle, placed);
        if (!x) break;
        expect(g.solution).toContainEqual(x.rect);
        placed.push(x.rect);
      }
    }
  });

  it("grades larger boards as harder", () => {
    const avg = (d: Difficulty) => {
      let s = 0;
      for (let i = 0; i < 4; i++) s += generate(createRng(`g${i}`), d).grade;
      return s / 4;
    };
    const e = avg("easy"),
      m = avg("medium"),
      h = avg("hard"),
      x = avg("mega");
    expect(m).toBeGreaterThan(e);
    expect(h).toBeGreaterThan(m);
    expect(x).toBeGreaterThan(h);
    expect(grade(tiny)).toBeGreaterThanOrEqual(0);
  });
  it("hints from the empty board before the first move", () => {
    const g = generate(createRng("pre"), "easy");
    expect(hint(g.puzzle, g.solution, undefined)).toEqual(hint(g.puzzle, g.solution, []));
    expect(hint(g.puzzle, g.solution, undefined)).not.toBeNull();
  });
});
