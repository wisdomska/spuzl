import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  countSolutions,
  deduce,
  field,
  FLAG,
  flood,
  generate,
  grade,
  HIDDEN,
  hint,
  neighbours,
  OPEN,
  SHAPE,
  solveFromStart,
  TRIPPED,
  verify,
  type TripwirePuzzle,
} from "./logic";

const solvedState = (p: TripwirePuzzle): number[] => {
  const m = new Set(p.mines);
  return Array.from({ length: p.w * p.h }, (_, i) => (m.has(i) ? FLAG : OPEN));
};

describe("tripwire", () => {
  it("counts neighbours and floods through zeros", () => {
    expect(neighbours(3, 3, 4)).toHaveLength(8);
    expect(neighbours(3, 3, 0).sort()).toEqual([1, 3, 4]);
    const p: TripwirePuzzle = { w: 4, h: 3, mines: [3], start: 0 };
    const f = field(p);
    expect(f).toEqual([0, 0, 1, -1, 0, 0, 1, 1, 0, 0, 0, 0]);
    const opened = flood(p, f, new Array(12).fill(HIDDEN), 0);
    expect(opened.sort((a, b) => a - b)).toEqual([0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11]);
    const flagged = new Array(12).fill(HIDDEN);
    flagged[1] = FLAG;
    expect(flood(p, f, flagged, 1)).toEqual([]);
    expect(flood(p, f, new Array(12).fill(HIDDEN), 3)).toEqual([]);
  });

  it("deduces with single numbers, subsets, enumeration and the mine total", () => {
    // 1 2 1 over three hidden tiles: classic subset, middle is safe, ends are mines.
    const p: TripwirePuzzle = { w: 3, h: 2, mines: [3, 5], start: 1 };
    const f = field(p);
    const open = [true, true, true, false, false, false];
    const ds = deduce(p, f, open, new Array(6).fill(false));
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) expect(d.mine).toBe(p.mines.includes(d.cell));
    // A satisfied number frees its hidden neighbours.
    const q: TripwirePuzzle = { w: 3, h: 1, mines: [0], start: 2 };
    const fq = field(q);
    expect(deduce(q, fq, [false, true, false], [true, false, false])).toEqual([{ cell: 2, mine: false, why: expect.stringContaining("already has its mines") }]);
    // Mine total: none left means the rest is safe.
    const r: TripwirePuzzle = { w: 3, h: 1, mines: [], start: 0 };
    expect(deduce(r, field(r), [true, false, false], [false, false, false]).every((d) => !d.mine)).toBe(true);
    // Only mines left hidden.
    const s: TripwirePuzzle = { w: 3, h: 3, mines: [8], start: 0 };
    const fs = field(s);
    const os = [true, true, true, true, true, true, true, true, false];
    expect(deduce(s, fs, os, new Array(9).fill(false))[0]).toMatchObject({ cell: 8, mine: true });
  });

  it("detects boards that need a guess", () => {
    // Two hidden tiles, one mine, no number tells them apart: a 50/50.
    const p: TripwirePuzzle = { w: 2, h: 4, mines: [6], start: 0 };
    expect(solveFromStart(p).solved).toBe(false);
    expect(countSolutions(p, 2)).toBe(2);
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates no-guess ${d} boards deterministically`, () => {
      const a = generate(createRng(`daily:${d}`), d);
      expect(generate(createRng(`daily:${d}`), d)).toEqual(a);
      const shape = SHAPE[d];
      expect(a.puzzle).toMatchObject({ w: shape.w, h: shape.h });
      expect(a.puzzle.mines).toHaveLength(shape.mines);
      expect(field(a.puzzle)[a.puzzle.start]).toBe(0);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
    });
  }

  it("generates 20+ no-guess boards whose deductions are always right", () => {
    for (let i = 0; i < 24; i++) {
      const g = generate(createRng(`free:${i}`), (["easy", "medium", "hard", "expert"] as const)[i % 4]);
      const p = g.puzzle;
      const f = field(p);
      const n = p.w * p.h;
      const open = new Array(n).fill(false);
      const mine = new Array(n).fill(false);
      const st = new Array(n).fill(HIDDEN);
      const reveal = (k: number) => flood(p, f, st, k).forEach((j) => (open[j] = st[j] = OPEN));
      reveal(p.start);
      for (;;) {
        const ds = deduce(p, f, open, mine);
        if (!ds.length) break;
        for (const d of ds) {
          expect(d.mine).toBe(p.mines.includes(d.cell));
          if (d.mine) mine[d.cell] = true;
          else reveal(d.cell);
        }
      }
      expect(open.filter(Boolean).length).toBe(n - p.mines.length);
    }
  });

  it("verifies a cleared board and rejects near misses and forged states", () => {
    const g = generate(createRng("verify"), "medium");
    const good = solvedState(g.puzzle);
    expect(verify(g.puzzle, g.solution, good)).toEqual({ ok: true, progress: 1 });
    // Tripped wires are mistakes, not failures; unflagged mines are fine too.
    const tripped: number[] = good.map((v) => (v === FLAG ? HIDDEN : v));
    tripped[g.solution[0]] = TRIPPED;
    expect(verify(g.puzzle, g.solution, tripped).ok).toBe(true);
    const miss = good.slice();
    miss[good.indexOf(OPEN)] = HIDDEN;
    expect(verify(g.puzzle, g.solution, miss).ok).toBe(false);
    const forged = good.slice();
    forged[g.solution[0]] = OPEN;
    expect(verify(g.puzzle, g.solution, forged).reason).toBe("impossible reveal");
    const fakeTrip = good.slice();
    fakeTrip[good.indexOf(OPEN)] = TRIPPED;
    expect(verify(g.puzzle, g.solution, fakeTrip).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, [1]).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, new Array(good.length).fill(7)).ok).toBe(false);
  });

  it("progress is the share of safe tiles opened", () => {
    const g = generate(createRng("progress"), "easy");
    const s = new Array(g.puzzle.w * g.puzzle.h).fill(HIDDEN);
    expect(logic.progress(g.puzzle, g.solution, s)).toBe(0);
    s[g.puzzle.start] = OPEN;
    expect(logic.progress(g.puzzle, g.solution, s)).toBeCloseTo(1 / (s.length - g.solution.length));
    expect(logic.progress(g.puzzle, g.solution, [])).toBe(0);
  });

  it("hints start the board, fix bad flags and walk to the clear", () => {
    const g = generate(createRng("hints"), "hard");
    const p = g.puzzle;
    const f = field(p);
    const s = new Array(p.w * p.h).fill(HIDDEN);
    expect(hint(p, g.solution, s)).toEqual({ target: p.start, text: "Start here. It opens a clear patch." });
    flood(p, f, s, p.start).forEach((j) => (s[j] = OPEN));
    const safeHidden = s.findIndex((v, i) => v === HIDDEN && f[i] >= 0);
    s[safeHidden] = FLAG;
    expect(hint(p, g.solution, s)?.target).toBe(safeHidden);
    s[safeHidden] = HIDDEN;
    for (let k = 0; k < s.length * 2 && !verify(p, g.solution, s).ok; k++) {
      const h = hint(p, g.solution, s)!;
      expect(h).not.toBeNull();
      const i = h.target as number;
      if (f[i] < 0) {
        expect(h.text).toMatch(/Flag|mine/);
        s[i] = FLAG;
      } else flood(p, f, s, i).forEach((j) => (s[j] = OPEN));
    }
    expect(verify(p, g.solution, s).ok).toBe(true);
    expect(hint(p, g.solution, s)).toBeNull();
    expect(hint(p, g.solution, [2])).toBeNull();
  });

  it("falls back to a safe tile when nothing is forced", () => {
    const p: TripwirePuzzle = { w: 2, h: 4, mines: [6], start: 0 };
    const s = [OPEN, OPEN, OPEN, OPEN, HIDDEN, HIDDEN, HIDDEN, HIDDEN];
    const f = field(p);
    s.forEach((v, i) => v === OPEN && expect(f[i]).toBeGreaterThanOrEqual(0));
    const h = hint(p, p.mines, s)!;
    expect(p.mines.includes(h.target as number)).toBe(false);
  });

  it("grades bigger, denser boards harder", () => {
    const e = generate(createRng("g"), "easy");
    const m = generate(createRng("g"), "mega");
    expect(grade(m.puzzle)).toBeGreaterThan(grade(e.puzzle));
    expect(m.grade).toBeLessThanOrEqual(100);
  });
});
