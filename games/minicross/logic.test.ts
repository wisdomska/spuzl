import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { isWord } from "@/games/_shared/words";
import logic, { checkGuess, contentCount, generate, generateAt, grade, hint, progress, verify } from "./logic";
import { CONTENT, needsReview } from "./content";
import { cellsOf, clueAt, numberGrid, SIZE, validCells } from "./rules";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
/** Proper nouns used as answers on purpose (places), not in the common word list. */
const NAMES = new Set(["ACCRA", "TEMA", "LAGOS", "NIGER", "TOGO", "GARI"]);

describe("minicross content", () => {
  it("has 60 grids whose entries are real words with one clue each", () => {
    expect(needsReview).toBe(true);
    expect(CONTENT.length).toBeGreaterThanOrEqual(60);
    const seen = new Set<string>();
    for (const e of CONTENT) {
      expect(e.rows).toHaveLength(SIZE);
      const grid = e.rows.join("");
      expect(grid).toMatch(/^[A-Z#]{25}$/);
      expect(seen.has(grid)).toBe(false);
      seen.add(grid);
      const { across, down } = numberGrid(
        grid.split("").map((x) => x === "#"),
        SIZE,
      );
      expect(e.across).toHaveLength(across.length);
      expect(e.down).toHaveLength(down.length);
      for (const [list, dir, clues] of [
        [across, "across", e.across],
        [down, "down", e.down],
      ] as const) {
        list.forEach((cl, k) => {
          const word = cellsOf(cl, dir, SIZE)
            .map((i) => grid[i])
            .join("");
          expect(isWord(word) || NAMES.has(word), word).toBe(true);
          expect(clues[k].toUpperCase().split(/\W+/), `${word}: ${clues[k]}`).not.toContain(word);
          expect(clues[k]).not.toMatch(/[–—]/);
        });
      }
    }
  });
});

describe("minicross generator", () => {
  it("sends shape and clues only, deterministic per day", () => {
    for (const d of DIFFS) {
      const g = generateAt(4, d);
      expect(generateAt(4, d)).toEqual(g);
      expect(g.puzzle).not.toHaveProperty("grid");
      expect(g.puzzle).not.toHaveProperty("rows");
      expect(g.puzzle.blocks.filter(Boolean).length).toBe(g.solution.grid.filter((x) => x === "#").length);
      if (d === "easy") {
        const given = Object.entries(g.puzzle.given ?? {});
        expect(given).toHaveLength(3);
        for (const [k, v] of given) expect(g.solution.grid[Number(k)]).toBe(v);
      } else expect(g.puzzle.given).toBeUndefined();
    }
    expect(generate(createRng("q"), "hard")).toEqual(generate(createRng("q"), "hard"));
    expect(generateAt(contentCount, "hard").solution).toEqual(generateAt(0, "hard").solution);
    expect(generateAt(-1, "hard").solution.grid.join("")).toBe(CONTENT[contentCount - 1].rows.join(""));
  });

  it("grades monotonically across difficulties", () => {
    for (let i = 0; i < 20; i++) {
      const gs = DIFFS.map((d) => generateAt(i, d).grade);
      for (let k = 1; k < gs.length; k++) expect(gs[k]).toBeGreaterThan(gs[k - 1]);
    }
    expect(grade(new Array(25).fill("Z"), "mega")).toBeLessThanOrEqual(100);
  });
});

describe("minicross guesses and verification", () => {
  const { puzzle, solution } = generateAt(0, "medium");
  const answer = solution.grid.map((x) => (x === "#" ? "" : x));

  it("checks only full grids and never says which squares are wrong", () => {
    expect(checkGuess(puzzle, solution, { cells: answer })).toEqual({ ok: true });
    const wrong = answer.slice();
    const k = wrong.findIndex(Boolean);
    wrong[k] = wrong[k] === "A" ? "B" : "A";
    expect(checkGuess(puzzle, solution, { cells: wrong })).toEqual({ ok: false });
    const part = answer.slice();
    part[k] = "";
    expect(checkGuess(puzzle, solution, { cells: part })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, { cells: ["a"] })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, null as never)).toEqual({ ok: false });
  });

  it("verifies, scores progress and rejects malformed state", () => {
    expect(verify(puzzle, solution, { cells: answer })).toEqual({ ok: true, progress: 1 });
    const blocksAsHash = solution.grid.map((x) => x);
    expect(verify(puzzle, solution, { cells: blocksAsHash }).ok).toBe(true);
    const wrong = answer.slice();
    const k = wrong.findIndex(Boolean);
    wrong[k] = wrong[k] === "A" ? "B" : "A";
    expect(verify(puzzle, solution, { cells: wrong })).toMatchObject({ ok: false, reason: "wrong letters" });
    expect(verify(puzzle, solution, { cells: new Array(25).fill("") })).toMatchObject({ ok: false, progress: 0, reason: "incomplete" });
    expect(verify(puzzle, solution, { cells: new Array(25).fill("ab") }).ok).toBe(false);
    expect(verify(puzzle, solution, null as never).ok).toBe(false);
    expect(progress(puzzle, solution, null as never)).toBe(0);
    expect(progress(puzzle, solution, { cells: wrong })).toBeCloseTo(22 / 23);
    expect(validCells(puzzle, "x")).toBe(false);
  });

  it("hints fix a wrong square first, then fill the next empty one", () => {
    const wrong = answer.slice();
    const k = wrong.findIndex(Boolean);
    wrong[k] = wrong[k] === "A" ? "B" : "A";
    const h = hint(puzzle, solution, { cells: wrong })!;
    expect(h.target).toEqual({ cell: k, letter: solution.grid[k] });
    expect(h.text).toMatch(/^Fixed/);
    const e = hint(puzzle, solution, { cells: new Array(25).fill("") })!;
    expect((e.target as { cell: number }).cell).toBe(solution.grid.findIndex((x) => x !== "#"));
    expect(e.text).toMatch(/^Filled/);
    expect(hint(puzzle, solution, null as never)).not.toBeNull();
    expect(hint(puzzle, solution, { cells: answer })).toBeNull();
  });

  it("clue helpers", () => {
    const first = puzzle.across[0];
    expect(clueAt(puzzle, first.r * SIZE + first.c, "across")).toBe(first);
    expect(clueAt(puzzle, -1, "down")).toBeUndefined();
    expect(logic.id).toBe("minicross");
  });
});
