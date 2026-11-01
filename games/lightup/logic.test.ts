import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  analyze,
  BLACK,
  countSolutions,
  EMPTY,
  engineSolve,
  generate,
  geometry,
  hint,
  LAMP,
  MARK,
  SPEC,
  verify,
  WHITE,
  type LightUpPuzzle,
} from "./logic";

const W = WHITE,
  B = BLACK;
/** 3 × 3 with a 4 in the middle: the four sides must hold lamps, the corners are lit by them. */
const plus: LightUpPuzzle = { size: 3, grid: [W, W, W, W, 4, W, W, W, W] };
const stateWith = (p: LightUpPuzzle, lamps: number[], marks: number[] = []) =>
  p.grid.map((_, i) => (lamps.includes(i) ? LAMP : marks.includes(i) ? MARK : EMPTY));

describe("lightup rules", () => {
  it("lights rows and columns until a black cell", () => {
    const p: LightUpPuzzle = { size: 3, grid: [W, B, W, W, W, W, W, W, W] };
    const a = analyze(p, stateWith(p, [0]));
    expect([...a.lit].sort()).toEqual([0, 3, 6]); // the black cell at 1 blocks the row
    expect(geometry(p).see[3].sort()).toEqual([0, 4, 5, 6]);
  });

  it("flags lamps that see each other and over-full numbers", () => {
    const p: LightUpPuzzle = { size: 3, grid: [W, W, W, W, 1, W, W, W, W] };
    expect(analyze(p, stateWith(p, [0, 2])).bad).toEqual(new Set([0, 2]));
    expect(analyze(p, stateWith(p, [1, 7])).bad.has(4)).toBe(true);
  });

  it("solves and counts a tiny board", () => {
    expect(countSolutions(plus, 5)).toBe(1);
    expect(engineSolve(plus, 1)).toEqual([1, 3, 5, 7]);
    expect(verify(plus, { lamps: [1, 3, 5, 7] }, stateWith(plus, [1, 3, 5, 7]))).toEqual({ ok: true, progress: 1 });
    // Without the number there are many ways to light it.
    const open: LightUpPuzzle = { size: 3, grid: [W, W, W, W, B, W, W, W, W] };
    expect(countSolutions(open, 10)).toBeGreaterThan(1);
    expect(engineSolve(open, 2)).toBeNull();
  });

  it("explains the plus with a number fill", () => {
    const h = hint(plus, { lamps: [1, 3, 5, 7] }, stateWith(plus, []))!;
    expect(h.text).toBe("The 4 at row 2, column 2 has only 4 free sides, so they all get lamps.");
    expect([1, 3, 5, 7]).toContain(h.target);
  });
});

describe("lightup generation", () => {
  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates 20 unique ${d} boards that verify`, () => {
      for (let i = 0; i < 20; i++) {
        const g = generate(createRng(`lightup:${d}:${i}`), d);
        const p = g.puzzle;
        expect(p.size).toBe(SPEC[d].size);
        expect(countSolutions(p, 2)).toBe(1);
        expect(verify(p, g.solution, stateWith(p, g.solution.lamps)).ok).toBe(true);
        // The engine at the difficulty's level finds the same lamps from scratch.
        expect(engineSolve(p, SPEC[d].level)).toEqual(g.solution.lamps);
        // Near misses: one lamp missing, or one extra lamp.
        expect(verify(p, g.solution, stateWith(p, g.solution.lamps.slice(1))).ok).toBe(false);
        const extra = geometry(p).white.find((c) => !g.solution.lamps.includes(c))!;
        expect(verify(p, g.solution, stateWith(p, [...g.solution.lamps, extra])).ok).toBe(false);
        expect(g.grade).toBeGreaterThanOrEqual(0);
        expect(g.grade).toBeLessThanOrEqual(100);
      }
    }, 120_000);
  }

  it("is deterministic per seed", () => {
    expect(generate(createRng("daily:lightup"), "hard")).toEqual(generate(createRng("daily:lightup"), "hard"));
  });
});

describe("lightup verification", () => {
  const g = generate(createRng("verify"), "medium");
  const p = g.puzzle;

  it("rejects malformed states and ignores X marks", () => {
    expect(verify(p, g.solution, null as never).reason).toBe("malformed state");
    expect(verify(p, g.solution, [1, 2] as never).reason).toBe("malformed state");
    expect(verify(p, g.solution, new Array(p.size ** 2).fill(7)).reason).toBe("malformed state");
    const dark = geometry(p).white.filter((c) => !g.solution.lamps.includes(c));
    expect(verify(p, g.solution, stateWith(p, g.solution.lamps, dark)).ok).toBe(true);
  });

  it("accepts a lamp layout that satisfies every rule even if stored differently", () => {
    // verify checks the rules, not the stored answer: same lamps in any order of placement.
    const s = stateWith(p, [...g.solution.lamps].reverse());
    expect(verify(p, g.solution, s).ok).toBe(true);
  });

  it("progress never leaks the answer", () => {
    expect(logic.progress(p, g.solution, stateWith(p, []))).toBe(0);
    const mid = logic.progress(p, g.solution, stateWith(p, g.solution.lamps.slice(0, 3)));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    // A wrong but legal lamp earns progress like a right one: progress is lit cells, not correctness.
    const wrong = geometry(p).white.find((c) => !g.solution.lamps.includes(c))!;
    expect(logic.progress(p, g.solution, stateWith(p, [wrong]))).toBeGreaterThan(0);
  });
});

describe("lightup hints", () => {
  for (const d of ["easy", "hard", "mega"] as Difficulty[]) {
    it(`${d}: every hint is a real deduction that is true of the solution, until solved`, () => {
      for (let s = 0; s < 6; s++) {
        const g = generate(createRng(`hints:${d}:${s}`), d);
        const p = g.puzzle;
        const lamps = new Set(g.solution.lamps);
        const cells = stateWith(p, []);
        for (let step = 0; step < 400 && !analyze(p, cells).clear; step++) {
          const h = hint(p, g.solution, cells)!;
          expect(h).not.toBeNull();
          expect(h.text).not.toMatch(/dead end/); // the engine always has a reason on generated boards
          expect(h.text).not.toMatch(/[–—]/);
          const t = h.target as number;
          expect(p.grid[t]).toBe(WHITE);
          expect(cells[t]).toBe(EMPTY);
          // Lamp hints point at solution lamps; dark hints at non-lamps.
          const lampHint = /gets? (a )?lamps?|lamp goes|needs a lamp|they all get lamps/.test(h.text);
          expect(lamps.has(t)).toBe(lampHint);
          cells[t] = lampHint ? LAMP : MARK;
        }
        expect(verify(p, g.solution, cells).ok).toBe(true);
        expect(hint(p, g.solution, cells)).toBeNull();
      }
    }, 120_000);
  }

  it("names slips before deductions", () => {
    const g = generate(createRng("slips"), "easy");
    const p = g.puzzle;
    const wrong = geometry(p).white.find((c) => !g.solution.lamps.includes(c))!;
    expect(hint(p, g.solution, stateWith(p, [wrong]))).toEqual({ target: wrong, text: "This lamp does not belong here, so take it off." });
    const right = g.solution.lamps[0];
    expect(hint(p, g.solution, stateWith(p, [], [right]))).toEqual({
      target: right,
      text: "This X covers a cell that needs a lamp, so clear it.",
    });
    expect(hint(p, g.solution, null as never)).toBeNull();
  });

  it("hard boards need lookahead somewhere, with a reason", () => {
    let seen = false;
    for (let s = 0; s < 6 && !seen; s++) {
      const g = generate(createRng(`deep:${s}`), "hard");
      if (engineSolve(g.puzzle, 1)) continue;
      seen = true;
      const cells = stateWith(g.puzzle, []);
      const texts: string[] = [];
      for (let step = 0; step < 400 && !analyze(g.puzzle, cells).clear; step++) {
        const h = hint(g.puzzle, g.solution, cells)!;
        texts.push(h.text);
        cells[h.target as number] = g.solution.lamps.includes(h.target as number) ? LAMP : MARK;
      }
      expect(texts.some((t) => /^(A lamp at|Leaving)/.test(t))).toBe(true);
    }
    expect(seen).toBe(true);
  });
});
