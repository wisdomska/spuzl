import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, { countSolutions, generate, hint, progress, SIZE, verify } from "./logic";

/** The engine is covered in games/_shared/sudoku/logic.test.ts; these pin Sixer's own contract. */
describe("sixer", () => {
  it("is a 6x6 sudoku with 2 x 3 boxes", () => {
    const g = generate(createRng("sixer"), "easy");
    expect(logic.id).toBe("sixer");
    expect(SIZE).toBe(6);
    expect(g.puzzle).toMatchObject({ size: 6, boxW: 3, boxH: 2 });
    expect(g.puzzle.givens).toHaveLength(36);
  });

  it("generates unique puzzles for every difficulty, deterministically, over 20+ seeds", () => {
    const ds: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
    for (let i = 0; i < 25; i++) {
      const d = ds[i % ds.length];
      const a = generate(createRng(`daily:${i}`), d);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      if (i < 5) expect(generate(createRng(`daily:${i}`), d)).toEqual(a);
    }
  }, 30000);

  it("fewer clues as difficulty rises", () => {
    const clues = (d: Difficulty) => generate(createRng("curve"), d).puzzle.givens.filter(Boolean).length;
    expect(clues("easy")).toBeGreaterThan(clues("medium"));
    expect(clues("medium")).toBeGreaterThanOrEqual(clues("hard"));
  });

  it("verifies, reports progress and hints", () => {
    const g = generate(createRng("v"), "medium");
    const s = { values: g.solution.slice(), notes: new Array(36).fill(0) };
    expect(verify(g.puzzle, g.solution, s)).toEqual({ ok: true, progress: 1 });
    expect(progress(g.puzzle, g.solution, s)).toBe(1);
    expect(hint(g.puzzle, g.solution, s)).toBeNull();
    const blank = { values: g.puzzle.givens.slice(), notes: new Array(36).fill(0) };
    expect(verify(g.puzzle, g.solution, blank).ok).toBe(false);
    expect(hint(g.puzzle, g.solution, blank)?.text).toMatch(/fits|only spot/);
  });
});
