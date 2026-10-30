import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { ART, artCells, needsReview } from "./art";
import logic, {
  analyze,
  cluesFor,
  countSolutions,
  CROSS,
  EMPTY,
  FILL,
  generate,
  grade,
  hint,
  lineSolve,
  nextDeduction,
  runs,
  SIZE_FOR,
  solveLine,
  UNKNOWN,
  verify,
} from "./logic";

const U = UNKNOWN;

describe("pixl", () => {
  it("reads runs and builds clues", () => {
    expect(runs([1, 1, 0, 1, 0, 0, 1, 1, 1])).toEqual([2, 1, 3]);
    expect(runs([0, 0])).toEqual([]);
    const p = cluesFor(3, 2, [1, 0, 1, 1, 1, 0]);
    expect(p.rows).toEqual([[1, 1], [2]]);
    expect(p.cols).toEqual([[2], [1], [1]]);
  });

  it("line solver settles overlaps, gaps and contradictions", () => {
    expect(solveLine([4], [U, U, U, U, U])).toEqual([U, 1, 1, 1, U]);
    expect(solveLine([1, 1], [U, U, U])).toEqual([1, 0, 1]);
    expect(solveLine([], [U, U])).toEqual([0, 0]);
    expect(solveLine([2], [U, 1, U, U, U])).toEqual([U, 1, U, 0, 0]);
    expect(solveLine([2], [U, 0, U, U])).toEqual([0, 0, 1, 1]);
    expect(solveLine([3], [1, 0, U, U])).toBeNull();
    expect(solveLine([1], [1, 1])).toBeNull();
  });

  it("every library picture is line solvable and unique", () => {
    expect(needsReview).toBe(true);
    for (const a of ART) {
      const c = artCells(a);
      expect(a.rows.every((r) => r.length === c.w)).toBe(true);
      const p = cluesFor(c.w, c.h, c.cells);
      expect(lineSolve(p).solved, a.name).toBe(true);
      expect(countSolutions(p, 2), a.name).toBe(1);
    }
  });

  it("counts several solutions for ambiguous clues", () => {
    const p = cluesFor(2, 2, [1, 0, 0, 1]);
    expect(countSolutions(p, 5)).toBe(2);
    expect(lineSolve(p).solved).toBe(false);
    expect(countSolutions({ w: 2, h: 1, rows: [[3]], cols: [[1], [1]] }, 2)).toBe(0);
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates unique ${d} puzzles deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.w).toBe(SIZE_FOR[d]);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(lineSolve(a.puzzle).grid).toEqual(a.solution);
    });
  }

  it("generates 20+ unique boards, from art and from patterns", () => {
    for (let i = 0; i < 30; i++) {
      const g = generate(createRng(`free:${i}`), (["easy", "medium", "hard"] as const)[i % 3]);
      expect(countSolutions(g.puzzle, 2)).toBe(1);
      const share = g.solution.filter(Boolean).length / g.solution.length;
      expect(share).toBeGreaterThan(0.2);
    }
  });

  it("flags over-full lines, dims finished ones and spots a clear", () => {
    const p = cluesFor(3, 3, [1, 1, 0, 0, 1, 0, 1, 1, 1]);
    const s = [FILL, FILL, FILL, 0, 0, 0, 0, 0, 0];
    const a = analyze(p, s);
    expect([...a.bad].sort()).toEqual([0, 1, 2]);
    expect(a.message).toBe("Row 1 has more filled cells than its clue.");
    const q = cluesFor(4, 1, [1, 0, 1, 0]);
    expect(analyze(q, [FILL, FILL, 0, 0]).message).toBe("Row 1 has a run longer than any clue.");
    const good = [FILL, FILL, CROSS, CROSS, FILL, 0, FILL, FILL, FILL];
    expect(analyze(p, good).clear).toBe(true);
    expect(analyze(p, [FILL, FILL, 0, 0, 0, 0, 0, 0, 0]).done.has(0)).toBe(true);
  });

  it("verifies the picture and rejects near misses and malformed input", () => {
    const g = generate(createRng("verify"), "medium");
    const n = g.solution.length;
    const good: number[] = g.solution.map((v) => (v ? FILL : CROSS));
    expect(verify(g.puzzle, g.solution, good)).toEqual({ ok: true, progress: 1 });
    expect(verify(g.puzzle, g.solution, g.solution.map((v) => (v ? FILL : EMPTY))).ok).toBe(true);
    const miss = good.slice();
    miss[g.solution.indexOf(1)] = EMPTY;
    expect(verify(g.puzzle, g.solution, miss).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, [1]).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, new Array(n).fill(5)).ok).toBe(false);
    // A layout that meets tampered clues but is not the scheduled picture.
    const p = cluesFor(2, 2, [1, 0, 0, 1]);
    expect(verify(p, [1, 0, 0, 1], [0, FILL, FILL, 0]).ok).toBe(false);
  });

  it("progress counts right fills minus wrong ones", () => {
    const g = generate(createRng("progress"), "easy");
    const total = g.solution.filter(Boolean).length;
    const s = new Array(g.solution.length).fill(EMPTY);
    expect(logic.progress(g.puzzle, g.solution, s)).toBe(0);
    s[g.solution.indexOf(1)] = FILL;
    expect(logic.progress(g.puzzle, g.solution, s)).toBeCloseTo(1 / total);
    s[g.solution.indexOf(0)] = FILL;
    expect(logic.progress(g.puzzle, g.solution, s)).toBe(0);
    expect(logic.progress(g.puzzle, g.solution, [])).toBe(0);
    expect(logic.progress(cluesFor(1, 1, [0]), [0], [0])).toBe(1);
  });

  it("hints fix mistakes first and then lead to the picture", () => {
    const g = generate(createRng("hints"), "hard");
    const s = new Array(g.solution.length).fill(EMPTY);
    const off = g.solution.indexOf(0), on = g.solution.indexOf(1);
    s[off] = FILL;
    expect(hint(g.puzzle, g.solution, s)).toEqual({ target: off, text: "This cell stays empty." });
    s[off] = EMPTY;
    s[on] = CROSS;
    expect(hint(g.puzzle, g.solution, s)?.target).toBe(on);
    s[on] = EMPTY;
    for (let k = 0; k < s.length * 2 && !verify(g.puzzle, g.solution, s).ok; k++) {
      const h = hint(g.puzzle, g.solution, s);
      expect(h).not.toBeNull();
      const i = h!.target as number;
      s[i] = h!.text.includes("stays empty") ? CROSS : FILL;
      expect(s[i] === FILL).toBe(g.solution[i] === 1);
    }
    expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
    expect(hint(g.puzzle, g.solution, s)).toBeNull();
    expect(hint(g.puzzle, g.solution, [9])).toBeNull();
  });

  it("falls back to revealing a cell when line logic is stuck", () => {
    const p = cluesFor(2, 2, [1, 0, 0, 1]);
    expect(nextDeduction(p, [0, 0, 0, 0])).toBeNull();
    expect(hint(p, [1, 0, 0, 1], [0, 0, 0, 0])).toEqual({ target: 0, text: "Fill this one." });
  });

  it("grades bigger boards harder", () => {
    const e = generate(createRng("g"), "easy");
    const x = generate(createRng("g"), "mega");
    expect(grade(x.puzzle)).toBeGreaterThan(grade(e.puzzle));
    expect(x.grade).toBeLessThanOrEqual(100);
  });
});
