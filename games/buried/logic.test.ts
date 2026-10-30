import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, { checkGuess, contentCount, DIRS_FOR, generate, generateAt, grade, hint, occurrences, place, progress, ROWS_FOR, verify } from "./logic";
import { CONTENT, needsReview } from "./content";
import { isStraight, leftovers, lineBetween, snapLine, splitPhrase, wordOn } from "./rules";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

describe("buried content", () => {
  it("has 60 themes with a short phrase and enough distinct words", () => {
    expect(needsReview).toBe(true);
    expect(CONTENT.length).toBeGreaterThanOrEqual(60);
    for (const e of CONTENT) {
      expect(e.phrase).toMatch(/^[A-Z]+( [A-Z]+)*$/);
      expect(e.phrase.replace(/ /g, "").length).toBeLessThanOrEqual(16);
      expect(new Set(e.words).size).toBe(e.words.length);
      for (const w of e.words) expect(w).toMatch(/^[A-Z]{3,9}$/);
    }
  });
});

describe("buried generator", () => {
  it("leaves exactly the phrase over, each word in one spot, for 20+ themes per difficulty", () => {
    for (const d of DIFFS) {
      for (let i = 0; i < 22; i++) {
        const g = generateAt(i, d);
        const { puzzle, solution } = g;
        expect(puzzle.rows).toBe(ROWS_FOR[d]);
        const all = solution.placements.map((p) => p.cells);
        expect(leftovers(puzzle, all)).toBe(solution.phrase.replace(/ /g, ""));
        expect(splitPhrase(leftovers(puzzle, all), puzzle.phraseShape).join(" ")).toBe(solution.phrase);
        for (const p of solution.placements) {
          expect(occurrences(puzzle.letters, puzzle.rows, puzzle.cols, p.word)).toBe(1);
          expect(wordOn(puzzle, p.cells)).toBe(p.word);
        }
        expect(JSON.stringify(puzzle)).not.toContain(solution.phrase.replace(/ /g, ""));
      }
    }
  }, 60000);

  it("is deterministic, wraps indexes and grades up with difficulty", () => {
    expect(generateAt(9, "hard")).toEqual(generateAt(9, "hard"));
    expect(generateAt(contentCount + 1, "easy").puzzle.theme).toBe(CONTENT[1].theme);
    expect(generateAt(-1, "easy").puzzle.theme).toBe(CONTENT[contentCount - 1].theme);
    expect(generate(createRng("b"), "medium")).toEqual(generate(createRng("b"), "medium"));
    for (let i = 0; i < 20; i++) {
      const gs = DIFFS.map((d) => generateAt(i, d).grade);
      for (let k = 1; k < gs.length; k++) expect(gs[k]).toBeGreaterThan(gs[k - 1]);
    }
    expect(grade(20, 8, 40, "mega")).toBe(100);
  }, 60000);

  it("place fails cleanly when the target cannot be hit", () => {
    expect(place(["AB"], 3, 3, DIRS_FOR.easy, 9, createRng("x"))).toBeNull();
  });
});

describe("buried lines and verification", () => {
  const { puzzle, solution } = generateAt(5, "expert");
  const all = solution.placements.map((p) => p.cells);

  it("snaps drags to straight lines and reads words either way", () => {
    expect(lineBetween(0, 2, 7)).toEqual([0, 1, 2]);
    expect(lineBetween(0, 9, 7)).toBeNull();
    expect(snapLine(0, 15, 9, 7)).toEqual([0, 8]);
    expect(snapLine(0, 16, 9, 7)).toEqual([0, 8, 16]);
    expect(snapLine(0, 22, 9, 7)).toEqual([0, 7, 14, 21]);
    expect(snapLine(0, 6 + 7, 9, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(isStraight([0, 2], 9, 7)).toBe(false);
    expect(isStraight("x", 9, 7)).toBe(false);
    const p0 = solution.placements[0];
    expect(wordOn(puzzle, p0.cells.slice().reverse())).toBe(p0.word);
    expect(wordOn(puzzle, [0, 9])).toBeNull();
  });

  it("checks lines against the hidden placements", () => {
    const p0 = solution.placements[0];
    expect(checkGuess(puzzle, solution, p0.cells)).toEqual({ ok: true, word: p0.word });
    expect(checkGuess(puzzle, solution, p0.cells.slice().reverse())).toEqual({ ok: true, word: p0.word });
    expect(checkGuess(puzzle, solution, p0.cells.slice(0, -1))).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, [0, 2])).toEqual({ ok: false });
  });

  it("verifies all words and rejects repeats, wrong lines and junk", () => {
    expect(verify(puzzle, solution, { found: all })).toEqual({ ok: true, progress: 1 });
    expect(verify(puzzle, solution, { found: all.slice(1) }).ok).toBe(false);
    expect(verify(puzzle, solution, { found: [all[0], all[0]] }).ok).toBe(false);
    expect(verify(puzzle, solution, { found: [[0, 1]] }).ok).toBe(false);
    expect(verify(puzzle, solution, null as never).ok).toBe(false);
    expect(progress(puzzle, solution, { found: [all[0]] })).toBeCloseTo(1 / all.length);
    expect(progress(puzzle, solution, { found: "x" } as never)).toBe(0);
  });

  it("hints point at the start of the shortest unfound word", () => {
    const h = hint(puzzle, solution, { found: [] })!;
    const shortest = solution.placements.slice().sort((a, b) => a.word.length - b.word.length)[0];
    expect(h.target).toBe(shortest.cells[0]);
    expect(hint(puzzle, solution, { found: all })).toBeNull();
    expect(hint(puzzle, solution, { found: [[0, 1]] })).not.toBeNull();
    expect(logic.id).toBe("buried");
  });
});
