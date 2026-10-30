import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { logicLevel, TECHNIQUE } from "@/games/_shared/sudoku/logic";
import logic, { countSolutions, generate, hint, progress, SIZE, verify } from "./logic";

/** The engine is covered in games/_shared/sudoku/logic.test.ts; these pin Nine's own contract. */
describe("nine", () => {
  it("is a 9x9 sudoku with 3 x 3 boxes", () => {
    const g = generate(createRng("nine"), "easy");
    expect(logic.id).toBe("nine");
    expect(SIZE).toBe(9);
    expect(g.puzzle).toMatchObject({ size: 9, boxW: 3, boxH: 3 });
    expect(g.puzzle.givens).toHaveLength(81);
  });

  it("generates unique puzzles for every difficulty, deterministically, over 20+ seeds", () => {
    const ds: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
    for (let i = 0; i < 20; i++) {
      const d = ds[i % ds.length];
      const a = generate(createRng(`daily:${i}`), d);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      if (i < 5) expect(generate(createRng(`daily:${i}`), d)).toEqual(a);
    }
  }, 60000);

  it("follows the four step technique curve", () => {
    const e = generate(createRng("curve"), "easy");
    const m = generate(createRng("curve"), "medium");
    const h = generate(createRng("curve"), "hard");
    const x = generate(createRng("curve"), "expert");
    expect(logicLevel(e.puzzle).level).toBe(TECHNIQUE.nakedSingle);
    expect(logicLevel(m.puzzle).level).toBe(TECHNIQUE.nakedSingle);
    expect(logicLevel(h.puzzle).level).toBeGreaterThanOrEqual(TECHNIQUE.locked);
    expect(logicLevel(x.puzzle).level).toBeGreaterThanOrEqual(TECHNIQUE.nakedPair);
    const clues = (g: typeof e) => g.puzzle.givens.filter(Boolean).length;
    expect(clues(e)).toBeGreaterThan(clues(m));
    expect(clues(m)).toBeGreaterThan(clues(x));
    expect(e.grade).toBeLessThan(m.grade);
    expect(m.grade).toBeLessThan(x.grade);
  }, 30000);

  it("verifies, reports progress and hints", () => {
    const g = generate(createRng("v"), "medium");
    const s = { values: g.solution.slice(), notes: new Array(81).fill(0) };
    expect(verify(g.puzzle, g.solution, s)).toEqual({ ok: true, progress: 1 });
    expect(progress(g.puzzle, g.solution, s)).toBe(1);
    expect(hint(g.puzzle, g.solution, s)).toBeNull();
    const blank = { values: g.puzzle.givens.slice(), notes: new Array(81).fill(0) };
    expect(verify(g.puzzle, g.solution, blank).ok).toBe(false);
    expect(hint(g.puzzle, g.solution, blank)?.text).toMatch(/fits|only spot/);
  });
});
