import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { fromView, toView, viewDims } from "@/games/_shared/rotate";
import logic, {
  bonusWords,
  checkGuess,
  contentCount,
  DIRS_FOR,
  generate,
  generateAt,
  grade,
  hint,
  occurrences,
  place,
  progress,
  ROWS_FOR,
  verify,
} from "./logic";
import { CONTENT, needsReview } from "./content";
import { isStraight, leftovers, lineBetween, snapLine, splitPhrase, wordOn, type BuriedPuzzle, type BuriedSolution } from "./rules";

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

  describe("bonus words", () => {
    // row 0 reads LAKE (off the list), row 1 hides CAKE; X, Q, Z, J are filler
    const p: BuriedPuzzle = {
      ...puzzle,
      rows: 2,
      cols: 7,
      letters: [..."LAKEXQZ", ..."CAKEJJJ"],
      words: ["CAKE"],
      phraseShape: [3, 3],
    };
    const s: BuriedSolution = { placements: [{ word: "CAKE", cells: [7, 8, 9, 10] }], phrase: "XQZ JJJ" };

    it("counts a real off-list word on a straight line as a bonus, read either way", () => {
      expect(checkGuess(p, s, [0, 1, 2, 3])).toEqual({ ok: false, bonus: true, word: "LAKE" });
      expect(checkGuess(p, s, [3, 2, 1, 0])).toEqual({ ok: false, bonus: true, word: "LAKE" });
      expect(checkGuess(p, s, [7, 8, 9, 10])).toEqual({ ok: true, word: "CAKE" });
      // too short, not a word, or not straight: no bonus
      expect(checkGuess(p, s, [0, 1, 2])).toEqual({ ok: false });
      expect(checkGuess(p, s, [3, 4, 5, 6])).toEqual({ ok: false });
      expect(checkGuess(p, s, [0, 8, 2, 3])).toEqual({ ok: false });
      // a listed word is never a bonus, even off its spot
      expect(checkGuess({ ...p, words: ["CAKE", "LAKE"] }, s, [0, 1, 2, 3])).toEqual({ ok: false });
    });

    it("verify re-checks bonus words, never lets them clear the board, and keeps old saves valid", () => {
      expect(bonusWords(p, s, { found: [], bonus: [[3, 2, 1, 0]] })).toEqual(["LAKE"]);
      expect(verify(p, s, { found: [], bonus: [[0, 1, 2, 3]] })).toMatchObject({ ok: false, progress: 0, reason: "incomplete" });
      expect(verify(p, s, { found: [[7, 8, 9, 10]], bonus: [[0, 1, 2, 3]] })).toEqual({ ok: true, progress: 1 });
      expect(verify(p, s, { found: [[7, 8, 9, 10]] })).toEqual({ ok: true, progress: 1 });
      // bonus words never count as found words
      expect(verify(p, s, { found: [[0, 1, 2, 3]] }).ok).toBe(false);
      // forged, repeated or malformed bonus entries are rejected
      expect(verify(p, s, { found: [[7, 8, 9, 10]], bonus: [[3, 4, 5, 6]] }).ok).toBe(false);
      expect(verify(p, s, { found: [[7, 8, 9, 10]], bonus: [[7, 8, 9, 10]] }).ok).toBe(false);
      expect(
        verify(p, s, {
          found: [[7, 8, 9, 10]],
          bonus: [
            [0, 1, 2, 3],
            [3, 2, 1, 0],
          ],
        }).ok,
      ).toBe(false);
      expect(verify(p, s, { found: [[7, 8, 9, 10]], bonus: "x" } as never).ok).toBe(false);
      // leftovers ignore bonus lines, so the secret phrase is unchanged
      expect(leftovers(p, [[7, 8, 9, 10]])).toBe("LAKEXQZJJJ");
    });
  });

  it("rotating the view maps taps back to the same cells and keeps lines straight", () => {
    const { rows, cols } = puzzle;
    for (let t = 0; t < 4; t++) {
      const [vr, vc] = viewDims(rows, cols, t);
      for (let i = 0; i < rows * cols; i++) {
        const [r, c] = toView(i, rows, cols, t);
        expect(r < vr && c < vc).toBe(true);
        expect(fromView(r, c, rows, cols, t)).toBe(i);
      }
      // every hidden word, tapped end to end on the rotated view, snaps to the same line and checks out
      for (const pl of solution.placements) {
        const [ar, ac] = toView(pl.cells[0], rows, cols, t);
        const [br, bc] = toView(pl.cells[pl.cells.length - 1], rows, cols, t);
        const line = snapLine(fromView(ar, ac, rows, cols, t), fromView(br, bc, rows, cols, t), rows, cols);
        expect(line).toEqual(pl.cells);
        expect(checkGuess(puzzle, solution, line)).toEqual({ ok: true, word: pl.word });
      }
    }
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
