import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import logic, {
  analyze,
  countSolutions,
  crossings,
  edgeCells,
  findEdges,
  generate,
  grade,
  hint,
  SHAPE_FOR,
  solveAll,
  verify,
  type Island,
  type IslesPuzzle,
} from "./logic";
import type { Difficulty } from "@/games/types";

const make = (rows: number, cols: number, islands: Island[]): IslesPuzzle => ({
  rows,
  cols,
  islands,
  edges: findEdges(rows, cols, islands),
});
/** corners of a 3x3, each needing n bridges */
const square = (n: number) =>
  make(3, 3, [
    { r: 0, c: 0, n },
    { r: 0, c: 2, n },
    { r: 2, c: 0, n },
    { r: 2, c: 2, n },
  ]);

describe("isles", () => {
  it("finds sight lines, bridge cells and crossings", () => {
    const sq = square(2);
    expect(sq.edges).toEqual([
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
    ]);
    expect(edgeCells(sq, [0, 1])).toEqual([1]);
    expect(edgeCells(sq, [0, 2])).toEqual([3]);
    const plus = make(3, 3, [
      { r: 0, c: 1, n: 1 },
      { r: 1, c: 0, n: 1 },
      { r: 1, c: 2, n: 1 },
      { r: 2, c: 1, n: 1 },
    ]);
    const x = crossings(plus);
    expect(plus.edges.length).toBe(2);
    expect(x[0]).toEqual([1]);
    expect(countSolutions(plus, 5)).toBe(0);
    const a = analyze(plus, [1, 1]);
    expect(a.crossed.size).toBe(2);
    expect(a.complete).toBe(false);
  });

  it("analyses counts, over-full islands and connection", () => {
    const sq = square(2);
    expect(analyze(sq, [1, 1, 1, 1]).complete).toBe(true);
    const split = analyze(sq, [2, 0, 0, 2]);
    expect(split.count).toEqual([2, 2, 2, 2]);
    expect(split.complete).toBe(false);
    expect(analyze(sq, [2, 1, 0, 0]).over.has(0)).toBe(true);
  });

  it("solver counts every solution and respects the budget", () => {
    expect(countSolutions(square(2), 5)).toBe(1);
    expect(solveAll(square(3), 5).solutions.length).toBe(2);
    expect(countSolutions(square(3), 1)).toBe(1);
    expect(countSolutions(square(5), 5)).toBe(0);
    expect(solveAll(square(3), 5, 1).exhausted).toBe(true);
    expect(countSolutions(square(3), 5)).toBe(2);
    const line = make(1, 3, [
      { r: 0, c: 0, n: 1 },
      { r: 0, c: 2, n: 1 },
    ]);
    expect(solveAll(line, 5).solutions).toEqual([[1]]);
    // two separate pairs can never be connected
    const apart = make(3, 3, [
      { r: 0, c: 0, n: 1 },
      { r: 0, c: 2, n: 1 },
      { r: 2, c: 0, n: 0 },
    ]);
    expect(countSolutions({ ...apart, islands: apart.islands.slice(0, 2).concat({ r: 2, c: 2, n: 0 }), edges: [[0, 1]] }, 5)).toBe(0);
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates unique ${d} puzzles deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.rows).toBe(SHAPE_FOR[d].size);
      expect(a.puzzle.islands.length).toBe(SHAPE_FOR[d].islands);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(analyze(a.puzzle, a.solution).complete).toBe(true);
      for (const isl of a.puzzle.islands) expect(isl.n).toBeGreaterThanOrEqual(1);
    });
  }

  it("generates unique boards across 24 seeds", () => {
    for (let i = 0; i < 24; i++) {
      const g = generate(createRng(`free:${i}`), i % 2 ? "medium" : "easy");
      expect(countSolutions(g.puzzle, 2)).toBe(1);
    }
  });

  it("verifies the solution and rejects near misses and malformed input", () => {
    const { puzzle, solution } = generate(createRng("isles:verify"), "medium");
    expect(verify(puzzle, solution, solution)).toEqual({ ok: true, progress: 1 });
    const k = solution.findIndex((v) => v > 0);
    const less = solution.slice();
    less[k]--;
    expect(verify(puzzle, solution, less).reason).toBe("incomplete");
    const more = solution.slice();
    const j = solution.findIndex((v) => v < 2);
    more[j]++;
    expect(verify(puzzle, solution, more).ok).toBe(false);
    expect(verify(puzzle, solution, [1]).reason).toBe("malformed state");
    expect(
      verify(
        puzzle,
        solution,
        solution.map(() => 3),
      ).ok,
    ).toBe(false);
    expect(verify(puzzle, solution, null as unknown as number[]).ok).toBe(false);
    const plus = make(3, 3, [
      { r: 0, c: 1, n: 1 },
      { r: 1, c: 0, n: 1 },
      { r: 1, c: 2, n: 1 },
      { r: 2, c: 1, n: 1 },
    ]);
    expect(verify(plus, [1, 0], [1, 1]).reason).toBe("cross");
    expect(verify(square(2), [1, 1, 1, 1], [2, 1, 0, 0]).reason).toBe("over");
    const [s1, s2] = solveAll(square(3), 2).solutions;
    expect(verify(square(3), s1, s2).reason).toBe("valid but not the scheduled solution");
  });

  it("progress counts matching bridges and subtracts extras", () => {
    const { puzzle, solution } = generate(createRng("isles:progress"), "easy");
    const zero = solution.map(() => 0);
    expect(logic.progress(puzzle, solution, zero)).toBe(0);
    expect(logic.progress(puzzle, solution, solution)).toBe(1);
    const extra = solution.map((v) => (v === 0 ? 2 : v));
    if (solution.some((v) => v === 0)) expect(logic.progress(puzzle, solution, extra)).toBeLessThan(1);
    expect(logic.progress(puzzle, solution, "x" as unknown as number[])).toBe(0);
  });

  it("hints are safe: following them always reaches the solution", () => {
    const { puzzle, solution } = generate(createRng("isles:hints"), "hard");
    let s = solution.map(() => 0);
    // an extra bridge is pointed at first
    const z = solution.findIndex((v) => v < 2);
    const wrong = s.slice();
    wrong[z] = solution[z] + 1;
    expect(hint(puzzle, solution, wrong)?.target).toBe(z);
    for (let k = 0; k < solution.length + 2 && !verify(puzzle, solution, s).ok; k++) {
      const h = hint(puzzle, solution, s)!;
      const e = h.target as number;
      const v = h.text.startsWith("Two") ? 2 : h.text.startsWith("One") ? 1 : 0;
      expect(v).toBe(solution[e]);
      s = s.slice();
      s[e] = v;
    }
    expect(verify(puzzle, solution, s).ok).toBe(true);
    expect(hint(puzzle, solution, s)).toBeNull();
    expect(hint(puzzle, solution, "x" as unknown as number[])).not.toBeNull();
    const extra = solution.map(() => 2);
    expect(hint(puzzle, solution, extra)?.text).toMatch(/bridge/);
  });

  it("grades bigger boards as harder", () => {
    const e = generate(createRng("g1"), "easy");
    const m = generate(createRng("g1"), "hard");
    const x = generate(createRng("g1"), "mega");
    expect(m.grade).toBeGreaterThan(e.grade);
    expect(x.grade).toBeGreaterThan(m.grade);
    expect(grade(e.puzzle, e.solution)).toBe(e.grade);
    expect(grade(e.puzzle)).toBeGreaterThanOrEqual(0);
    expect(x.grade).toBeLessThanOrEqual(100);
  });
});
