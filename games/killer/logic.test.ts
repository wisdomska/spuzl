import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { analyze } from "@/games/_shared/sudoku/logic";
import logic, {
  combos,
  countSolutions,
  generate,
  hint,
  nextDeduction,
  progress,
  rule45,
  SIZE_FOR,
  solve,
  solvesByLogic,
  verify,
  type KillerPuzzle,
} from "./logic";

const DS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const state = (values: number[]) => ({ values, notes: new Array(values.length).fill(0) });

describe("killer sums", () => {
  it("is 6 x 6 on easy and medium, 9 x 9 from hard up", () => {
    expect(logic.id).toBe("killer");
    for (const d of DS) {
      const g = generate(createRng(`size:${d}`), d);
      expect(g.puzzle.size).toBe(SIZE_FOR[d]);
      expect(g.puzzle).toMatchObject(SIZE_FOR[d] === 6 ? { boxW: 3, boxH: 2 } : { boxW: 3, boxH: 3 });
    }
  }, 30000);

  for (const d of DS)
    it(`${d}: 20 seeds are unique, cover the grid with valid cages, verify and reject`, () => {
      for (let i = 0; i < 20; i++) {
        const g = generate(createRng(`killer:${d}:${i}`), d);
        const p = g.puzzle;
        const n = p.size * p.size;
        // Cages tile the grid, are connected, add up and never repeat a digit.
        const seen = new Set<number>();
        for (const c of p.cages) {
          c.cells.forEach((x) => seen.add(x));
          expect(c.cells.reduce((a, x) => a + g.solution[x], 0)).toBe(c.sum);
          expect(new Set(c.cells.map((x) => g.solution[x])).size).toBe(c.cells.length);
          const reach = new Set([c.cells[0]]);
          for (let k = 0; k < c.cells.length; k++)
            for (const x of reach)
              for (const y of c.cells)
                if (Math.abs(x - y) === p.size || (Math.abs(x - y) === 1 && Math.floor(x / p.size) === Math.floor(y / p.size)))
                  reach.add(y);
          expect(reach.size).toBe(c.cells.length);
        }
        expect(seen.size).toBe(n);
        expect(countSolutions(p, 2)).toBe(1);
        expect(solve(p)).toEqual(g.solution);
        // Every level falls to the hint engine (the 45 rule included) with no guessing.
        expect(solvesByLogic(p)).toBe(true);
        // Givens are part of the answer and few.
        p.givens.forEach((v, x) => v && expect(v).toBe(g.solution[x]));
        expect(p.givens.filter(Boolean).length).toBeLessThanOrEqual(p.size === 9 ? 8 : 4);
        expect(verify(p, g.solution, state(g.solution.slice()))).toEqual({ ok: true, progress: 1 });
        // A swap of two digits in a row keeps the row legal but breaks a cage or column.
        const wrong = g.solution.slice();
        const a = wrong.findIndex((_, x) => !p.givens[x] && !p.givens[x + 1] && (x + 1) % p.size !== 0);
        [wrong[a], wrong[a + 1]] = [wrong[a + 1], wrong[a]];
        expect(verify(p, g.solution, state(wrong)).ok).toBe(false);
        expect(verify(p, g.solution, state(p.givens.slice())).ok).toBe(false);
        if (i < 2) expect(generate(createRng(`killer:${d}:${i}`), d)).toEqual(g);
      }
    }, 120000);

  it("hints are safe: every deduction from the start matches the answer, through to a full grid on easy", () => {
    for (const d of ["easy", "medium", "hard"] as Difficulty[])
      for (let i = 0; i < 4; i++) {
        const g = generate(createRng(`hint:${d}:${i}`), d);
        const values = g.puzzle.givens.slice();
        for (;;) {
          const s = nextDeduction(g.puzzle, values);
          if (!s) break;
          expect(values[s.cell]).toBe(0);
          expect(s.value).toBe(g.solution[s.cell]);
          expect(s.why.length).toBeGreaterThan(5);
          values[s.cell] = s.value;
        }
        if (d === "easy") expect(values).toEqual(g.solution);
        // The server hint points at a cell and gives the right digit for it.
        const h = hint(g.puzzle, g.solution, state(g.puzzle.givens.slice()))!;
        expect(typeof h.target).toBe("number");
        expect(g.puzzle.givens[h.target as number]).toBe(0);
      }
  }, 60000);

  it("expert and mega: 20 seeds each fill to the answer step by step, every step safe, some by the 45 rule", () => {
    const reasons = new Set<string>();
    for (const d of ["expert", "mega"] as Difficulty[])
      for (let i = 0; i < 20; i++) {
        const g = generate(createRng(`hint45:${d}:${i}`), d);
        const values = g.puzzle.givens.slice();
        for (;;) {
          const s = nextDeduction(g.puzzle, values);
          if (!s) break;
          expect(values[s.cell]).toBe(0);
          expect(s.value).toBe(g.solution[s.cell]);
          if (s.why.startsWith("The digits in ")) reasons.add(s.why);
          values[s.cell] = s.value;
        }
        expect(values).toEqual(g.solution);
      }
    expect(reasons.size).toBeGreaterThan(0);
  }, 120000);

  it("the 45 rule finds innies and outies", () => {
    // 6 x 6: row 1 is 1 2 4 3 5 6 (adds to 21). Cages 0-1 (3) and 2-3-4 (12) sit inside it; cage 5-11 (6 + 4)
    // crosses into row 2, so cell 5 is an innie of 21 - 15 = 6 and cell 11 an outie of 10 - 6 = 4.
    const cages = [
      { cells: [0, 1], sum: 3 },
      { cells: [2, 3, 4], sum: 12 },
      { cells: [5, 11], sum: 10 },
    ];
    for (let x = 6; x < 36; x++) if (x !== 11) cages.push({ cells: [x], sum: 1 });
    const p: KillerPuzzle = { size: 6, boxW: 3, boxH: 2, givens: new Array(36).fill(0), cages };
    expect(rule45(p).filter((r) => r.where === "row 1")).toEqual([
      { cells: [5], sum: 6, where: "row 1", total: 21, side: "in" },
      { cells: [11], sum: 4, where: "row 1", total: 21, side: "out" },
    ]);
  });

  it("a hint flags a wrong digit first and is null when solved", () => {
    const g = generate(createRng("wrong"), "easy");
    const v = g.puzzle.givens.slice();
    const x = v.findIndex((d) => d === 0);
    v[x] = (g.solution[x] % 6) + 1;
    expect(hint(g.puzzle, g.solution, state(v))).toEqual({ target: x, text: `This ${v[x]} does not belong here.` });
    expect(hint(g.puzzle, g.solution, state(g.solution.slice()))).toBeNull();
    expect(progress(g.puzzle, g.solution, state(g.solution.slice()))).toBe(1);
    expect(progress(g.puzzle, g.solution, state(g.puzzle.givens.slice()))).toBe(0);
  });

  it("explains a cage with only one digit set", () => {
    expect(combos(9, 3, 7)).toEqual([0b1011]); // 1, 2 and 4
    // A solved 6 x 6 grid with a 3-cell cage of 7 across the top left, the rest single cells.
    const sol = [1, 2, 4, 3, 5, 6, 3, 5, 6, 1, 2, 4, 2, 1, 3, 4, 6, 5, 4, 6, 5, 2, 1, 3, 5, 3, 1, 6, 4, 2, 6, 4, 2, 5, 3, 1];
    const cages = [{ cells: [0, 1, 2], sum: 7 }];
    for (let x = 3; x < 36; x++) cages.push({ cells: [x], sum: sol[x] });
    const p: KillerPuzzle = { size: 6, boxW: 3, boxH: 2, givens: new Array(36).fill(0), cages };
    const values = sol.slice();
    values[0] = values[1] = values[2] = 0;
    expect(nextDeduction(p, values)).toEqual({ cell: 0, value: 1, why: "The 3-cell cage of 7 must be 1, 2 and 4, and only 1 fits here." });
  });

  it("analyze reports cage repeats and wrong totals", () => {
    const p: KillerPuzzle = { size: 6, boxW: 3, boxH: 2, givens: new Array(36).fill(0), cages: [{ cells: [0, 6], sum: 5 }] };
    const v = new Array(36).fill(0);
    v[0] = 2;
    v[6] = 2;
    expect(analyze(p, v).rule).toBe("column");
    const q: KillerPuzzle = { ...p, cages: [{ cells: [0, 1], sum: 5 }] };
    const w = new Array(36).fill(0);
    w[0] = 6;
    expect(analyze(q, w).rule).toBe("sum");
    expect(analyze(q, w).message).toBe("This cage must add to 5.");
    w[0] = 1;
    w[1] = 3;
    expect(analyze(q, w).rule).toBe("sum");
    w[1] = 4;
    expect(analyze(q, w).bad.size).toBe(0);
    // Cells 2 and 9 share no row, column or box, only the cage.
    const r: KillerPuzzle = { ...p, cages: [{ cells: [2, 3, 9], sum: 9 }] };
    const u = new Array(36).fill(0);
    u[2] = 3;
    u[9] = 3;
    expect(analyze(r, u).rule).toBe("cage");
    expect(analyze(r, u).message).toBe("Two 3s in one cage.");
  });
});
