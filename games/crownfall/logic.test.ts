import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import logic, { analyze, countSolutions, CROWN, EMPTY, generate, grade, hint, MARK, nextDeduction, SIZE_FOR, solve, verify } from "./logic";
import type { Difficulty } from "@/games/types";

const solvedState = (n: number, sol: number[]) => {
  const s = new Array(n * n).fill(EMPTY);
  sol.forEach((c, r) => (s[r * n + c] = CROWN));
  return s;
};

describe("crownfall", () => {
  it("ports the prototype analyze() rules and messages", () => {
    const p = { size: 4, regions: [0, 0, 0, 1, 0, 0, 1, 1, 2, 2, 3, 1, 2, 3, 3, 3] };
    const s = new Array(16).fill(EMPTY);
    s[0] = CROWN;
    s[5] = CROWN;
    expect(analyze(p, s).rule).toBe("region");
    const t = new Array(16).fill(EMPTY);
    t[1] = CROWN;
    t[6] = CROWN;
    expect(analyze(p, t).message).toBe("Those crowns are touching corners. Give them space.");
    const u = new Array(16).fill(EMPTY);
    u[0] = CROWN;
    u[3] = CROWN;
    expect(analyze(p, u).message).toBe("Two crowns in one row.");
  });

  for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
    it(`generates unique ${d} puzzles deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.size).toBe(SIZE_FOR[d]);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(solve(a.puzzle)).toEqual(a.solution);
      expect(new Set(a.puzzle.regions).size).toBe(a.puzzle.size);
    });
  }

  it("generates many unique 6x6 boards", () => {
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), "easy");
      expect(countSolutions(g.puzzle, 2)).toBe(1);
    }
  });

  it("verifies the solution and rejects near misses", () => {
    const g = generate(createRng("verify"), "easy");
    const n = g.puzzle.size;
    const good = solvedState(n, g.solution);
    expect(verify(g.puzzle, g.solution, good)).toEqual({ ok: true, progress: 1 });
    const missing = good.slice();
    missing[g.solution[0]] = EMPTY;
    expect(verify(g.puzzle, g.solution, missing).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, [1, 2, 3]).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, new Array(n * n).fill(7)).ok).toBe(false);
    const withMarks = good.map((v) => (v === EMPTY ? MARK : v));
    expect(verify(g.puzzle, g.solution, withMarks).ok).toBe(true);
  });

  it("reports progress without counting wrong crowns", () => {
    const g = generate(createRng("progress"), "easy");
    const n = g.puzzle.size;
    const s = new Array(n * n).fill(EMPTY);
    s[g.solution[0]] = CROWN;
    expect(logic.progress(g.puzzle, g.solution, s)).toBeCloseTo(1 / n);
    s[n + ((g.solution[1] + 3) % n)] = CROWN;
    expect(logic.progress(g.puzzle, g.solution, s)).toBeLessThanOrEqual(1 / n);
  });

  it("hints are safe: following them always reaches the solution", () => {
    const g = generate(createRng("hints"), "medium");
    const n = g.puzzle.size;
    const s = new Array(n * n).fill(EMPTY);
    const wrong = g.solution[0] === 0 ? 2 : 0;
    s[wrong] = CROWN;
    let h = hint(g.puzzle, g.solution, s);
    expect(h?.target).toBe(wrong);
    s[wrong] = EMPTY;
    for (let k = 0; k < n * n * 2 && !verify(g.puzzle, g.solution, s).ok; k++) {
      h = hint(g.puzzle, g.solution, s);
      expect(h).not.toBeNull();
      const i = h!.target as number;
      const isCrown = g.solution[Math.floor(i / n)] === i % n;
      s[i] = h!.text.includes("Mark it X") ? MARK : CROWN;
      if (s[i] === MARK) expect(isCrown).toBe(false);
      else expect(isCrown).toBe(true);
    }
    expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
    expect(hint(g.puzzle, g.solution, s)).toBeNull();
  });

  it("deductions never contradict the solution", () => {
    const g = generate(createRng("deduce"), "hard");
    const n = g.puzzle.size;
    const s = new Array(n * n).fill(EMPTY);
    for (;;) {
      const d = nextDeduction(g.puzzle, s);
      if (!d) break;
      const isCrown = g.solution[Math.floor(d.cell / n)] === d.cell % n;
      expect(d.value === CROWN).toBe(isCrown);
      s[d.cell] = d.value;
    }
  });

  it("grades larger boards as harder", () => {
    const e = generate(createRng("g1"), "easy");
    const h = generate(createRng("g1"), "expert");
    expect(grade(h.puzzle)).toBeGreaterThan(grade(e.puzzle));
    expect(e.grade).toBeGreaterThanOrEqual(0);
    expect(h.grade).toBeLessThanOrEqual(100);
  });
});
