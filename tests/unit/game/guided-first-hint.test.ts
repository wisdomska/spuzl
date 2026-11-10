import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
/** lib/game/service.ts `guidedSeed` (server only): the practice board is the easy board from this seed. */
const guidedSeed = (id: string) => `tutorial:${id}`;
import type { Difficulty } from "@/games/types";
import * as dusk from "@/games/dusk/logic";
import * as nine from "@/games/nine/logic";
import * as merge from "@/games/merge/logic";
import { nextDeduction as sudokuDeduction } from "@/games/_shared/sudoku/logic";

/**
 * R4-28 Guided first play: before the first move (no state yet, `undefined` in the shell or `null` over the wire)
 * Dusk, Nine and Merge give a real first-move hint instead of the rule. Each hint must be correct and safe: on
 * the logic puzzles it names an open cell whose value the clues force (the board has one solution, and that cell's
 * value in it is the hinted one; the opposite value leaves no solution), led by a deduction where there is one;
 * on Merge it names a swipe that moves the start board.
 */
const SEEDS = 150;
const seedsFor = (id: string) => [guidedSeed(id), ...Array.from({ length: SEEDS }, (_, k) => `r4-28:${id}:${k}`)];
const LEVELS: Difficulty[] = ["easy", "medium", "hard"];
const levelOf = (k: number): Difficulty => (k === 0 ? "easy" : LEVELS[k % LEVELS.length]);

describe("Dusk: first hint from the givens", () => {
  it("is a forced, correct cell on every seed, a deduction on the practice board", () => {
    let deductions = 0;
    seedsFor("dusk").forEach((seed, k) => {
      const { puzzle: p, solution: sol } = dusk.generate(createRng(seed), levelOf(k));
      for (const state of [undefined, null]) {
        const h = dusk.hint(p, sol, state);
        expect(h, seed).not.toBeNull();
        const cell = h!.target as number;
        expect(p.givens[cell], `${seed}: an open cell`).toBe(dusk.EMPTY);
        expect(h!.text).not.toMatch(/does not belong/);
      }
      const d = dusk.nextDeduction(p, p.givens.slice());
      const h = dusk.hint(p, sol, undefined)!;
      if (d) {
        deductions++;
        expect(h.target).toBe(d.cell);
        expect(d.value, `${seed}: the deduced value is the solution's`).toBe(sol[d.cell]);
      }
      // Safe: the board has one solution, and the other value at the hinted cell leaves none.
      const cell = h.target as number;
      expect(dusk.countSolutions(p)).toBe(1);
      const other = sol[cell] === dusk.SUN ? dusk.MOON : dusk.SUN;
      const wrong = { ...p, givens: p.givens.map((v, i) => (i === cell ? other : v)) };
      expect(dusk.countSolutions(wrong), `${seed}: the other value fails`).toBe(0);
      if (k === 0) expect(d, "the practice board opens with a deduction").not.toBeNull();
    });
    expect(deductions / (SEEDS + 1)).toBeGreaterThan(0.9);
  });

  it("the state after a move still hints as before", () => {
    const { puzzle: p, solution: sol } = dusk.generate(createRng(guidedSeed("dusk")), "easy");
    expect(dusk.hint(p, sol, p.givens.slice())).toEqual(dusk.hint(p, sol, undefined));
  });
});

describe("Nine: first hint from the givens", () => {
  it("is a forced, correct digit on every seed, a deduction on the practice board", () => {
    let deductions = 0;
    seedsFor("nine").forEach((seed, k) => {
      const { puzzle: p, solution: sol } = nine.generate(createRng(seed), levelOf(k));
      for (const state of [undefined, null]) {
        const h = nine.hint(p, sol, state as never);
        expect(h, seed).not.toBeNull();
        const cell = h!.target as number;
        expect(p.givens[cell], `${seed}: an open cell`).toBe(0);
        expect(h!.text).not.toMatch(/does not belong/);
      }
      const d = sudokuDeduction(p, p.givens.slice());
      const h = nine.hint(p, sol, undefined as never)!;
      if (d) {
        deductions++;
        expect(h.target).toBe(d.cell);
        expect(d.value, `${seed}: the deduced digit is the solution's`).toBe(sol[d.cell]);
      }
      expect(nine.countSolutions(p, 2)).toBe(1);
      const cell = h.target as number;
      // Safe: any other digit at the hinted cell leaves no solution (the board's one solution has sol[cell] there).
      const other = (sol[cell] % 9) + 1;
      expect(nine.countSolutions({ ...p, givens: p.givens.map((v, i) => (i === cell ? other : v)) }, 2), seed).toBe(0);
      if (k === 0) expect(d, "the practice board opens with a deduction").not.toBeNull();
    });
    expect(deductions / (SEEDS + 1)).toBeGreaterThan(0.9);
  });
});

describe("Merge: first hint on the start board", () => {
  it("names a swipe that moves the start board, on every seed", () => {
    seedsFor("merge").forEach((seed, k) => {
      const { puzzle: p, solution: sol } = merge.generate(createRng(seed), levelOf(k));
      const { board } = merge.initialBoard(p);
      for (const state of [undefined, null]) {
        const h = merge.hint(p, sol, state);
        expect(h, seed).not.toBeNull();
        const dir = h!.target as merge.Dir;
        expect(merge.DIRS).toContain(dir);
        expect(merge.slide(p.size, board, dir).changed, `${seed}: ${dir} moves the board`).toBe(true);
        expect(h!.text).toBe(`Try a swipe ${merge.DIR_WORD[dir]}.`);
      }
    });
  });
});
