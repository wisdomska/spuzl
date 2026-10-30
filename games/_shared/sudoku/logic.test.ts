import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import {
  analyze,
  boxOf,
  candidates,
  countSolutions,
  emptyState,
  generateSudoku,
  geometry,
  grade,
  hint,
  logicLevel,
  makeSudokuLogic,
  nextDeduction,
  progressOf,
  solve,
  TECHNIQUE,
  verify,
  type SudokuPuzzle,
} from "./logic";

const blank = (size: number, boxW: number, boxH: number): SudokuPuzzle => ({ size, boxW, boxH, givens: new Array(size * size).fill(0) });
const state = (values: number[]) => ({ values, notes: new Array(values.length).fill(0) });

describe("sudoku engine", () => {
  it("builds rows, columns and boxes", () => {
    const g = geometry(6, 3, 2);
    expect(g.units).toHaveLength(18);
    expect(g.units[12].cells).toEqual([0, 1, 2, 6, 7, 8]);
    expect(g.peers[0]).toHaveLength(5 + 5 + 2);
    expect(geometry(6, 3, 2)).toBe(g);
    const p = blank(9, 3, 3);
    expect(boxOf(p, 80)).toBe(8);
    expect(boxOf(blank(6, 3, 2), 35)).toBe(5);
  });

  it("flags duplicates by row, column and box", () => {
    const p = blank(6, 3, 2);
    const v = new Array(36).fill(0);
    v[0] = v[5] = 3;
    expect(analyze(p, v).message).toBe("Two 3s in one row.");
    const w = new Array(36).fill(0);
    w[0] = w[30] = 4;
    expect(analyze(p, w).rule).toBe("column");
    const x = new Array(36).fill(0);
    x[0] = x[8] = 2;
    expect(analyze(p, x).message).toBe("Two 2s in one 3 × 2 box.");
    expect(analyze(p, new Array(36).fill(0)).bad.size).toBe(0);
  });

  it("counts solutions and solves", () => {
    expect(countSolutions(blank(4, 2, 2), 3)).toBe(3);
    const bad = blank(4, 2, 2);
    bad.givens[0] = bad.givens[1] = 1;
    expect(countSolutions(bad, 2)).toBe(0);
    expect(solve(bad)).toBeNull();
    // Dead end: a cell with no candidates.
    const dead = blank(4, 2, 2);
    dead.givens[1] = 1;
    dead.givens[2] = 2;
    dead.givens[4] = 3;
    dead.givens[12] = 4;
    expect(countSolutions(dead, 2)).toBe(0);
    expect(candidates(dead, dead.givens)[0]).toBe(0);
  });

  it("finds naked singles, hidden singles and needs locked candidates or pairs when singles stall", () => {
    const p = blank(4, 2, 2);
    p.givens = [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(nextDeduction(p, p.givens)).toMatchObject({ cell: 3, value: 4, why: "Only 4 fits here." });
    const q = blank(4, 2, 2);
    q.givens = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    const d = nextDeduction(q, q.givens);
    expect(d).not.toBeNull();
    expect(d!.why).toContain("only spot for 1");
    expect(nextDeduction(blank(4, 2, 2), new Array(16).fill(0))).toBeNull();
    expect(logicLevel(blank(4, 2, 2)).level).toBe(TECHNIQUE.guess);
  });

  for (const size of [6, 9]) {
    for (const d of ["easy", "medium", "hard", "expert"] as const) {
      it(`generates unique ${size}x${size} ${d} puzzles deterministically`, () => {
        const a = generateSudoku(createRng(`daily:2026-11-02:${d}`), d, size);
        const b = generateSudoku(createRng(`daily:2026-11-02:${d}`), d, size);
        expect(a).toEqual(b);
        expect(a.puzzle.size).toBe(size);
        expect(countSolutions(a.puzzle, 2)).toBe(1);
        expect(solve(a.puzzle)).toEqual(a.solution);
        expect(analyze(a.puzzle, a.solution).clear).toBe(true);
        if (d === "easy" || d === "medium") expect(logicLevel(a.puzzle).level).toBe(1);
      }, 30000);
    }
  }

  it("generates 20+ unique Sixer and Nine boards", () => {
    for (let i = 0; i < 24; i++) {
      const g = generateSudoku(createRng(`free:${i}`), i % 3 ? "medium" : "hard", i % 2 ? 6 : 9);
      expect(countSolutions(g.puzzle, 2)).toBe(1);
    }
  }, 60000);

  it("verifies the solution and rejects near misses and malformed input", () => {
    const g = generateSudoku(createRng("verify"), "easy", 6);
    expect(verify(g.puzzle, g.solution, state(g.solution.slice()))).toEqual({ ok: true, progress: 1 });
    const open = g.puzzle.givens.indexOf(0);
    const miss = g.solution.slice();
    miss[open] = 0;
    expect(verify(g.puzzle, g.solution, state(miss)).ok).toBe(false);
    const swap = g.solution.slice();
    swap[open] = (swap[open] % 6) + 1;
    expect(verify(g.puzzle, g.solution, state(swap)).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, state([1, 2])).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, state(new Array(36).fill(7))).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, state(new Array(36).fill(1.5))).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as never).ok).toBe(false);
    const given = g.puzzle.givens.findIndex(Boolean);
    const tampered = g.solution.slice();
    tampered[given] = 0;
    expect(verify(g.puzzle, g.solution, state(tampered)).reason).toBe("givens changed");
    // Another valid grid for a tampered puzzle is not accepted.
    const other = blank(6, 3, 2);
    const alt = solve({ ...other, givens: g.solution.map((v, i) => (i === 0 ? (v % 6) + 1 : 0)) })!;
    expect(verify(other, g.solution, state(alt)).ok).toBe(false);
  });

  it("reports progress from correct open cells only", () => {
    const g = generateSudoku(createRng("progress"), "easy", 6);
    const s = emptyState(g.puzzle);
    expect(progressOf(g.puzzle, g.solution, s)).toBe(0);
    const open = g.puzzle.givens.flatMap((v, i) => (v ? [] : [i]));
    s.values[open[0]] = g.solution[open[0]];
    expect(progressOf(g.puzzle, g.solution, s)).toBeCloseTo(1 / open.length);
    s.values[open[1]] = (g.solution[open[1]] % 6) + 1;
    expect(progressOf(g.puzzle, g.solution, s)).toBeCloseTo(1 / open.length);
    expect(progressOf(g.puzzle, g.solution, { values: [], notes: [] })).toBe(0);
    expect(progressOf({ ...g.puzzle, givens: g.solution }, g.solution, state(g.solution))).toBe(1);
  });

  for (const [size, d] of [
    [6, "hard"],
    [9, "medium"],
    [9, "expert"],
  ] as const) {
    it(`hints are safe on ${size}x${size} ${d}`, () => {
      const g = generateSudoku(createRng(`hints:${d}`), d, size);
      const s = emptyState(g.puzzle);
      const open = g.puzzle.givens.indexOf(0);
      s.values[open] = (g.solution[open] % size) + 1;
      expect(hint(g.puzzle, g.solution, s)?.target).toBe(open);
      s.values[open] = 0;
      for (let k = 0; k < size * size && !verify(g.puzzle, g.solution, s).ok; k++) {
        const h = hint(g.puzzle, g.solution, s);
        expect(h).not.toBeNull();
        const i = h!.target as number;
        expect(s.values[i]).toBe(0);
        const m = /(\d)/.exec(h!.text);
        if (m) expect(Number(m[1])).toBe(g.solution[i]);
        s.values[i] = g.solution[i];
      }
      expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, s)).toBeNull();
      expect(hint(g.puzzle, g.solution, { values: [1], notes: [] })).toBeNull();
    }, 30000);
  }

  it("deductions never contradict the solution", () => {
    const g = generateSudoku(createRng("deduce"), "hard", 9);
    const v = g.puzzle.givens.slice();
    for (;;) {
      const d = nextDeduction(g.puzzle, v);
      if (!d) break;
      expect(d.value).toBe(g.solution[d.cell]);
      v[d.cell] = d.value;
    }
  }, 30000);

  it("grades harder plans and bigger grids higher", () => {
    const e6 = generateSudoku(createRng("g1"), "easy", 6);
    const h6 = generateSudoku(createRng("g1"), "hard", 6);
    const e9 = generateSudoku(createRng("g1"), "easy", 9);
    const x9 = generateSudoku(createRng("g1"), "expert", 9);
    expect(grade(h6.puzzle)).toBeGreaterThan(grade(e6.puzzle));
    expect(grade(e9.puzzle)).toBeGreaterThan(grade(e6.puzzle));
    expect(grade(x9.puzzle)).toBeGreaterThan(grade(e9.puzzle));
    expect(x9.grade).toBeLessThanOrEqual(100);
  }, 30000);

  it("wraps a GameLogic per size", () => {
    const l = makeSudokuLogic("sixer", 6);
    const g = l.generate(createRng("wrap"), "easy");
    expect(l.id).toBe("sixer");
    expect(l.countSolutions!(g.puzzle, 2)).toBe(1);
    expect(l.verify(g.puzzle, g.solution, state(g.solution)).ok).toBe(true);
    expect(l.progress(g.puzzle, g.solution, emptyState(g.puzzle))).toBe(0);
    expect(l.hint!(g.puzzle, g.solution, emptyState(g.puzzle))).not.toBeNull();
  });
});
