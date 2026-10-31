import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import logic, {
  checkPath,
  countSolutions,
  generate,
  grade,
  hint,
  maxClue,
  nextClue,
  SIZE_FOR,
  solveAll,
  stepError,
  verify,
  type WeavePuzzle,
} from "./logic";
import type { Difficulty } from "@/games/types";
import { adjacent, edgeKey } from "@/games/_shared/grid";

const easy = generate(createRng("weave:fixture"), "easy");

describe("weave", () => {
  it("checks steps against every rule", () => {
    // 3x3, numbers 1 at 0, 2 at 2, 3 at 8; wall between 4 and 5
    const p: WeavePuzzle = { size: 3, clues: [1, 0, 2, 0, 0, 0, 0, 0, 3], walls: [[4, 5]] };
    expect(stepError(p, [], 4)).toBe("order");
    expect(stepError(p, [], 0)).toBeNull();
    expect(stepError(p, [0], 4)).toBe("jump");
    expect(stepError(p, [0, 1], 8)).toBe("jump");
    expect(stepError(p, [0, 1, 4, 3], 0)).toBe("revisit");
    expect(stepError(p, [0, 3, 4], 5)).toBe("wall");
    expect(stepError(p, [0, 1, 2, 5], 8)).toBe("early-end");
    expect(stepError(p, [0, 3, 6, 7], 8)).toBe("order");
    expect(stepError(p, [0, 1], 2)).toBeNull();
    expect(stepError(p, [0, 1, 4], 99)).toBe("jump");
    const q: WeavePuzzle = { size: 3, clues: [1, 3, 2, 0, 0, 0, 0, 0, 4], walls: [] };
    expect(stepError(q, [0], 1)).toBe("order");
    expect(nextClue(q, [0, 3])).toBe(2);
    expect(maxClue(q)).toBe(4);
    expect(checkPath(p, [0, 1, 2, 5, 4, 3, 6, 7, 8]).complete).toBe(false);
    expect(checkPath(p, [0, 1, 2, 5, 8]).error).toBe("early-end");
  });

  it("solver counts every solution of a small board", () => {
    const open: WeavePuzzle = { size: 3, clues: [1, 0, 0, 0, 0, 0, 0, 0, 2], walls: [] };
    // corner to opposite corner Hamiltonian paths on 3x3
    expect(solveAll(open, { limit: 100 }).solutions.length).toBe(2);
    expect(countSolutions(open, 1)).toBe(1);
    const walled: WeavePuzzle = { ...open, walls: [[0, 1]] };
    expect(countSolutions(walled, 5)).toBe(1);
    const parity: WeavePuzzle = { size: 3, clues: [1, 2, 0, 0, 0, 0, 0, 0, 0], walls: [] };
    expect(countSolutions(parity, 5)).toBe(0);
    expect(countSolutions({ size: 3, clues: new Array(9).fill(0), walls: [] }, 5)).toBe(0);
    expect(solveAll(open, { limit: 100, budget: 1 }).exhausted).toBe(true);
    expect(countSolutions({ size: 6, clues: [1, 0, 0, 0, 0, 2, ...new Array(30).fill(0)], walls: [] }, 2)).toBe(2);
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates unique ${d} puzzles deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.size).toBe(SIZE_FOR[d]);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(verify(a.puzzle, a.solution, a.solution).ok).toBe(true);
      for (const [x, y] of a.puzzle.walls) {
        expect(adjacent(a.puzzle.size, x, y)).toBe(true);
        for (let k = 1; k < a.solution.length; k++) expect(edgeKey(a.solution[k - 1], a.solution[k])).not.toBe(edgeKey(x, y));
      }
    }, 30000);
  }

  it("generates unique boards across 24 seeds", () => {
    for (let i = 0; i < 24; i++) {
      const g = generate(createRng(`free:${i}`), i % 2 ? "medium" : "easy");
      expect(countSolutions(g.puzzle, 2)).toBe(1);
      expect(g.puzzle.clues[g.solution[0]]).toBe(1);
      expect(g.puzzle.clues[g.solution[g.solution.length - 1]]).toBe(maxClue(g.puzzle));
    }
  }, 60000);

  it("verifies the solution and rejects near misses and malformed input", () => {
    const { puzzle, solution } = easy;
    expect(verify(puzzle, solution, solution)).toEqual({ ok: true, progress: 1 });
    expect(verify(puzzle, solution, solution.slice(0, -1)).ok).toBe(false);
    expect(verify(puzzle, solution, solution.slice(0, -1)).reason).toBe("incomplete");
    const swapped = solution.slice();
    [swapped[3], swapped[4]] = [swapped[4], swapped[3]];
    expect(verify(puzzle, solution, swapped).ok).toBe(false);
    expect(verify(puzzle, solution, [1, 2, "x"] as unknown as number[]).reason).toBe("malformed state");
    expect(verify(puzzle, solution, null as unknown as number[]).ok).toBe(false);
    expect(verify(puzzle, solution, [-1]).ok).toBe(false);
    expect(verify(puzzle, solution, [...solution, solution[0]]).ok).toBe(false);
    // a valid path on tampered puzzle data is rejected against the scheduled solution
    const open: WeavePuzzle = { size: 3, clues: [1, 0, 0, 0, 0, 0, 0, 0, 2], walls: [] };
    const all = solveAll(open, { limit: 5 }).solutions;
    expect(verify(open, all[0], all[1]).reason).toBe("valid but not the scheduled solution");
  });

  it("progress counts the correct prefix only", () => {
    const { puzzle, solution } = easy;
    const N = solution.length;
    expect(logic.progress(puzzle, solution, [])).toBe(0);
    expect(logic.progress(puzzle, solution, solution.slice(0, 5))).toBeCloseTo(5 / N);
    expect(logic.progress(puzzle, solution, "bad" as unknown as number[])).toBe(0);
  });

  it("hints are safe: following them always reaches the solution", () => {
    const { puzzle, solution } = generate(createRng("weave:hints"), "medium");
    let s: number[] = [];
    expect(hint(puzzle, solution, s)?.text).toBe("Start on 1.");
    expect(hint(puzzle, solution, "x" as unknown as number[])?.target).toBe(solution[0]);
    // a wrong turn gets pointed at
    s = solution.slice(0, 4);
    const wrongTurn = [...s, solution[6]];
    expect(hint(puzzle, solution, wrongTurn)?.target).toBe(solution[6]);
    s = [];
    for (let k = 0; k < solution.length + 2 && !verify(puzzle, solution, s).ok; k++) {
      const h = hint(puzzle, solution, s)!;
      expect(stepError(puzzle, s, h.target as number)).toBeNull();
      s = [...s, h.target as number];
    }
    expect(verify(puzzle, solution, s).ok).toBe(true);
    expect(hint(puzzle, solution, s)).toBeNull();
  });

  it("grades larger, sparser boards as harder", () => {
    const e = generate(createRng("g1"), "easy");
    const x = generate(createRng("g1"), "expert");
    expect(x.grade).toBeGreaterThan(e.grade);
    expect(grade(e.puzzle)).toBe(e.grade);
    for (const g of [e, x]) {
      expect(g.grade).toBeGreaterThanOrEqual(0);
      expect(g.grade).toBeLessThanOrEqual(100);
    }
  }, 30000);
});
