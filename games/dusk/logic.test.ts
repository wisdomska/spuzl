import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  analyze,
  countSolutions,
  EMPTY,
  generate,
  grade,
  hint,
  logicSolvable,
  MOON,
  nextDeduction,
  propagate,
  RULE_COPY,
  SIZE_FOR,
  solve,
  SUN,
  verify,
  type DuskPuzzle,
} from "./logic";

const blank = (n: number): DuskPuzzle => ({ size: n, givens: new Array(n * n).fill(EMPTY), links: [] });

describe("dusk", () => {
  it("flags triples, overfull lines and broken links", () => {
    const p = blank(6);
    const s = new Array(36).fill(EMPTY);
    s[0] = s[1] = s[2] = SUN;
    let a = analyze(p, s);
    expect(a.rule).toBe("triple");
    expect([...a.bad].sort()).toEqual([0, 1, 2]);
    const t = new Array(36).fill(EMPTY);
    t[0] = t[2] = t[4] = t[5] = MOON;
    a = analyze(p, t);
    expect(a.rule).toBe("count");
    expect(a.message).toBe(RULE_COPY.count);
    const q: DuskPuzzle = { ...p, links: [{ a: 0, b: 1, same: true }, { a: 6, b: 12, same: false }] };
    const u = new Array(36).fill(EMPTY);
    u[0] = SUN;
    u[1] = MOON;
    expect(analyze(q, u).rule).toBe("same");
    u[1] = SUN;
    u[6] = MOON;
    u[12] = MOON;
    expect(analyze(q, u).rule).toBe("differ");
    expect(analyze(q, new Array(36).fill(EMPTY)).bad.size).toBe(0);
  });

  it("deduces from links, pairs, gaps and full lines", () => {
    const p: DuskPuzzle = { ...blank(6), links: [{ a: 0, b: 1, same: false }] };
    const s = new Array(36).fill(EMPTY);
    s[0] = SUN;
    expect(nextDeduction(p, s)).toMatchObject({ cell: 1, value: MOON });
    const q: DuskPuzzle = { ...blank(6), links: [{ a: 0, b: 6, same: true }] };
    const t = new Array(36).fill(EMPTY);
    t[6] = MOON;
    expect(nextDeduction(q, t)).toMatchObject({ cell: 0, value: MOON });
    const pair = new Array(36).fill(EMPTY);
    pair[1] = pair[2] = SUN;
    expect(nextDeduction(blank(6), pair)).toMatchObject({ cell: 0, value: MOON });
    const gap = new Array(36).fill(EMPTY);
    gap[0] = gap[2] = MOON;
    expect(nextDeduction(blank(6), gap)).toMatchObject({ cell: 1, value: SUN });
    const full = new Array(36).fill(EMPTY);
    full[0] = full[3] = full[5] = SUN;
    full[4] = MOON;
    const d = nextDeduction(blank(6), full);
    expect(d).toMatchObject({ value: MOON });
    expect(d!.why).toContain("Row 1");
    expect(nextDeduction(blank(6), new Array(36).fill(EMPTY))).toBeNull();
  });

  it("propagation reports contradictions", () => {
    const s = new Array(36).fill(EMPTY);
    s[0] = s[1] = s[2] = SUN;
    expect(propagate(blank(6), s)).toBe(false);
    const q = blank(6);
    q.givens[0] = q.givens[1] = q.givens[2] = SUN;
    expect(countSolutions(q, 2)).toBe(0);
    expect(solve(q)).toBeNull();
    expect(countSolutions(blank(4), 2)).toBe(2);
  });

  for (const d of ["easy", "medium", "hard", "expert"] as Difficulty[]) {
    it(`generates unique ${d} puzzles deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.size).toBe(SIZE_FOR[d]);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(solve(a.puzzle)).toEqual(a.solution);
      expect(analyze(a.puzzle, a.solution).clear).toBe(true);
      expect(a.puzzle.links.length).toBeGreaterThan(0);
      for (const l of a.puzzle.links) expect(l.b === l.a + 1 || l.b === l.a + a.puzzle.size).toBe(true);
    }, 30000);
  }

  it("generates the 10x10 Weekly Mega", () => {
    const g = generate(createRng("mega"), "mega");
    expect(g.puzzle.size).toBe(10);
    expect(countSolutions(g.puzzle, 2)).toBe(1);
  }, 30000);

  it("generates many unique 6x6 boards that fall to logic on easy", () => {
    for (let i = 0; i < 24; i++) {
      const g = generate(createRng(`free:${i}`), i % 2 ? "easy" : "medium");
      expect(countSolutions(g.puzzle, 2)).toBe(1);
      expect(logicSolvable(g.puzzle)).toBe(true);
    }
  }, 60000);

  it("verifies the solution and rejects near misses and malformed input", () => {
    const g = generate(createRng("verify"), "easy");
    expect(verify(g.puzzle, g.solution, g.solution.slice())).toEqual({ ok: true, progress: 1 });
    const open = g.puzzle.givens.findIndex((v) => v === EMPTY);
    const miss = g.solution.slice();
    miss[open] = EMPTY;
    expect(verify(g.puzzle, g.solution, miss).ok).toBe(false);
    const flip = g.solution.slice();
    flip[open] = flip[open] === SUN ? MOON : SUN;
    expect(verify(g.puzzle, g.solution, flip).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, [1, 2]).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, new Array(36).fill(9)).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, "nope" as unknown as number[]).ok).toBe(false);
    const given = g.puzzle.givens.findIndex((v) => v !== EMPTY);
    const tampered = g.solution.slice();
    tampered[given] = EMPTY;
    expect(verify(g.puzzle, g.solution, tampered).reason).toBe("givens changed");
    // A different valid layout (puzzle data swapped) is not accepted.
    const other = { ...g.puzzle, givens: new Array(36).fill(EMPTY), links: [] };
    const alt = solve({ ...other, givens: g.solution.map((v, i) => (i === 0 ? (v === SUN ? MOON : SUN) : EMPTY)) });
    expect(alt).not.toBeNull();
    expect(verify(other, g.solution, alt!).ok).toBe(false);
  });

  it("reports progress from correct open cells only", () => {
    const g = generate(createRng("progress"), "easy");
    const s = g.puzzle.givens.slice();
    expect(logic.progress(g.puzzle, g.solution, s)).toBe(0);
    const open = s.flatMap((v, i) => (v === EMPTY ? [i] : []));
    s[open[0]] = g.solution[open[0]];
    expect(logic.progress(g.puzzle, g.solution, s)).toBeCloseTo(1 / open.length);
    s[open[1]] = g.solution[open[1]] === SUN ? MOON : SUN;
    expect(logic.progress(g.puzzle, g.solution, s)).toBeCloseTo(1 / open.length);
    expect(logic.progress(g.puzzle, g.solution, [] as number[])).toBe(0);
    expect(logic.progress({ ...g.puzzle, givens: g.solution }, g.solution, g.solution)).toBe(1);
  });

  for (const d of ["medium", "hard"] as Difficulty[]) {
    it(`hints are safe on ${d}: following them always reaches the solution`, () => {
      const g = generate(createRng(`hints:${d}`), d);
      const s = g.puzzle.givens.slice();
      const open = s.indexOf(EMPTY);
      s[open] = g.solution[open] === SUN ? MOON : SUN;
      expect(hint(g.puzzle, g.solution, s)?.target).toBe(open);
      s[open] = EMPTY;
      for (let k = 0; k < 100 && !verify(g.puzzle, g.solution, s).ok; k++) {
        const h = hint(g.puzzle, g.solution, s);
        expect(h).not.toBeNull();
        const i = h!.target as number;
        expect(s[i]).toBe(EMPTY);
        s[i] = g.solution[i];
        expect(analyze(g.puzzle, s).bad.size).toBe(0);
      }
      expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, s)).toBeNull();
      expect(hint(g.puzzle, g.solution, [1])).toBeNull();
    });
  }

  it("deductions never contradict the solution", () => {
    const g = generate(createRng("deduce"), "expert");
    const s = g.puzzle.givens.slice();
    for (;;) {
      const d = nextDeduction(g.puzzle, s);
      if (!d) break;
      expect(d.value).toBe(g.solution[d.cell]);
      s[d.cell] = d.value;
    }
  }, 30000);

  it("grades larger and sparser boards as harder", () => {
    const e = generate(createRng("g1"), "easy");
    const x = generate(createRng("g1"), "expert");
    expect(grade(x.puzzle)).toBeGreaterThan(grade(e.puzzle));
    expect(e.grade).toBeGreaterThanOrEqual(0);
    expect(x.grade).toBeLessThanOrEqual(100);
  }, 30000);
});
