import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, { analyze, board, colOf, countSolutions, evaluate, generate, grade, hint, rowOf, solve, SPEC, verify, type EqualPuzzle, type EqualState } from "./logic";

const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
// 2×2:  1 + 2 = 3 / 3 × 4 = 12, columns 1 + 3 = 4, 2 × 4 = 8; blanks at 1 and 2 (numbers 2 and 3)
const tiny: EqualPuzzle = {
  n: 2,
  given: [1, 0, 0, 4],
  rowOps: [["+"], ["*"]],
  colOps: [["+"], ["*"]],
  rowRes: [3, 12],
  colRes: [4, 8],
  pool: [2, 3],
};
const tinySol = [1, 2, 3, 4];

describe("equal", () => {
  it("evaluates with × and ÷ before + and −, exactly", () => {
    expect(evaluate([2, 3, 4], ["+", "*"])).toEqual([14, 1]);
    expect(evaluate([8, 2, 3], ["/", "-"])).toEqual([1, 1]);
    expect(evaluate([7, 2], ["/"])).toEqual([7, 2]);
    expect(evaluate([7, 0], ["/"])).toBeNull();
    expect(evaluate([1, 5], ["-"])).toEqual([-4, 1]);
    expect(evaluate([3, 4, 2, 5], ["-", "/", "*"])).toEqual([-7, 1]);
  });

  it("reads rows and columns and merges givens", () => {
    expect(rowOf(tiny, tinySol, 1)).toEqual([3, 4]);
    expect(colOf(tiny, tinySol, 1)).toEqual([2, 4]);
    expect(board(tiny, [0, 2, 0, 0])).toEqual([1, 2, 0, 4]);
  });

  it("analyses false lines", () => {
    const a = analyze(tiny, [0, 3, 2, 0]);
    expect(a.message).toBe("Row 1 is not true.");
    expect([...a.bad].sort()).toEqual([0, 1, 2, 3]);
    expect(analyze(tiny, [0, 2, 3, 0]).clear).toBe(true);
    expect(analyze({ ...tiny, rowRes: [3, 99] }, [0, 2, 3, 0]).message).toBe("Row 2 is not true.");
    expect(analyze({ ...tiny, rowRes: [3, 12], colRes: [4, 9] }, [0, 2, 3, 0]).message).toBe("Column 2 is not true.");
  });

  it("solves the hand puzzle uniquely", () => {
    expect(countSolutions(tiny, 5)).toBe(1);
    expect(solve(tiny)).toEqual(tinySol);
    expect(solve(tiny, [0, 3, 0, 0])).toBeNull();
    expect(solve(tiny, [0, 9, 0, 0])).toBeNull();
    expect(countSolutions({ ...tiny, rowRes: [99, 12] }, 5)).toBe(0);
    // a+b=5, c+d=5, a+c=4, b+d=6 has two answers: 1 4 / 3 2 and 3 2 / 1 4
    const loose: EqualPuzzle = { n: 2, given: [0, 0, 0, 0], rowOps: [["+"], ["+"]], colOps: [["+"], ["+"]], rowRes: [5, 5], colRes: [4, 6], pool: [1, 2, 3, 4] };
    expect(countSolutions(loose, 5)).toBe(2);
    expect(countSolutions(loose, 1)).toBe(1);
  });

  for (const d of diffs) {
    it(`generates unique ${d} grids deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.n).toBe(SPEC[d].n);
      expect(a.puzzle.given.filter((g) => !g)).toHaveLength(SPEC[d].blanks);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(solve(a.puzzle)).toEqual(a.solution);
      expect([...a.puzzle.rowRes, ...a.puzzle.colRes].every((v) => v >= 0 && Number.isInteger(v))).toBe(true);
    }, 20_000);
  }

  it("generates 25 unique grids across seeds", () => {
    for (let i = 0; i < 25; i++) expect(countSolutions(generate(createRng(`free:${i}`), diffs[i % 5]).puzzle, 2)).toBe(1);
  }, 30_000);

  it("verifies the solution and rejects near misses and malformed input", () => {
    const g = generate(createRng("verify"), "hard");
    expect(verify(g.puzzle, g.solution, g.solution)).toEqual({ ok: true, progress: 1 });
    const onlyBlanks = g.solution.map((v, i) => (g.puzzle.given[i] ? 0 : v));
    expect(verify(g.puzzle, g.solution, onlyBlanks).ok).toBe(true);
    const blanks = g.puzzle.given.flatMap((v, i) => (v ? [] : [i]));
    const swapped = onlyBlanks.slice();
    [swapped[blanks[0]], swapped[blanks[1]]] = [swapped[blanks[1]], swapped[blanks[0]]];
    expect(verify(g.puzzle, g.solution, swapped).ok).toBe(false);
    const missing = onlyBlanks.slice();
    missing[blanks[0]] = 0;
    expect(verify(g.puzzle, g.solution, missing).reason).toBe("incomplete");
    const twice = onlyBlanks.slice();
    twice[blanks[0]] = twice[blanks[1]];
    expect(verify(g.puzzle, g.solution, twice).reason).toBe("numbers do not match the tray");
    expect(verify(g.puzzle, g.solution, [1]).reason).toBe("malformed state");
    const badGiven = g.solution.slice();
    const gi = g.puzzle.given.findIndex(Boolean);
    badGiven[gi] = badGiven[gi] + 1;
    expect(verify(g.puzzle, g.solution, badGiven).ok).toBe(false);
    expect(verify(tiny, [1, 3, 2, 4], [0, 2, 3, 0]).reason).toBe("valid but not the scheduled solution");
  });

  it("progress counts right placements minus wrong ones", () => {
    expect(logic.progress(tiny, tinySol, [0, 2, 0, 0])).toBe(0.5);
    expect(logic.progress(tiny, tinySol, [0, 3, 0, 0])).toBe(0);
    expect(logic.progress(tiny, tinySol, [0, 2, 3, 0])).toBe(1);
    expect(logic.progress(tiny, tinySol, "x" as unknown as EqualState)).toBe(0);
  });

  it("hints are safe: following them always completes the grid", () => {
    for (const d of diffs) {
      const g = generate(createRng(`hints:${d}`), d);
      const s = new Array(g.puzzle.n * g.puzzle.n).fill(0);
      const blanks = g.puzzle.given.flatMap((v, i) => (v ? [] : [i]));
      s[blanks[0]] = g.solution[blanks[1]];
      expect(hint(g.puzzle, g.solution, s)!.target).toBe(blanks[0]);
      s[blanks[0]] = 0;
      for (let k = 0; k < 40 && !verify(g.puzzle, g.solution, s).ok; k++) {
        const h = hint(g.puzzle, g.solution, s)!;
        const i = h.target as number;
        expect(h.text).toContain(String(g.solution[i]));
        s[i] = g.solution[i];
      }
      expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, s)).toBeNull();
    }
    expect(hint(tiny, tinySol, [] as EqualState)).toBeNull();
    // with no line one gap from done, the hint still reveals a placement
    const open: EqualPuzzle = { ...tiny, given: [0, 0, 0, 0], pool: [1, 2, 3, 4] };
    expect(hint(open, tinySol, [0, 0, 0, 0])).toEqual({ target: 0, text: "Try 1 here." });
  }, 20_000);

  it("grades harder settings higher", () => {
    const g = (d: Difficulty) => [0, 1, 2].reduce((s, i) => s + generate(createRng(`g${i}`), d).grade, 0) / 3;
    const e = g("easy"), m = g("medium"), h = g("hard"), x = g("expert"), mg = g("mega");
    expect(m).toBeGreaterThan(e);
    expect(h).toBeGreaterThan(m);
    expect(x).toBeGreaterThan(h);
    expect(mg).toBeGreaterThan(x);
    expect(grade(tiny)).toBeGreaterThanOrEqual(0);
  }, 20_000);
});
