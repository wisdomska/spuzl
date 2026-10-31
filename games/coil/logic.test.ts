import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { fromView, toView, viewDims } from "@/games/_shared/rotate";
import logic, {
  bonusWords,
  checkGuess,
  contentCount,
  countSolutions,
  generate,
  generateAt,
  grade,
  hint,
  layout,
  progress,
  tracings,
  verify,
} from "./logic";
import { CONTENT, needsReview } from "./content";
import { adjacent, COLS, ROWS, sameCells, spell, validPath, type CoilState } from "./rules";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

describe("coil content", () => {
  it("has 60 entries of exactly 30 letters, words of 4+ letters, flagged for review", () => {
    expect(needsReview).toBe(true);
    expect(CONTENT.length).toBeGreaterThanOrEqual(60);
    for (const e of CONTENT) {
      expect(e.words.join("").length, e.theme).toBe(ROWS * COLS);
      for (const w of e.words) expect(w).toMatch(/^[A-Z]{4,}$/);
      expect(e.theme).not.toMatch(/[–—]/);
    }
    expect(new Set(CONTENT.map((e) => e.theme)).size).toBe(CONTENT.length);
  });
});

describe("coil generator", () => {
  it("is deterministic per (entry, difficulty) and tiles the grid with the theme words", () => {
    for (const d of DIFFS) {
      const a = generateAt(3, d);
      expect(generateAt(3, d)).toEqual(a);
      const all = a.solution.paths.flat();
      expect(new Set(all).size).toBe(ROWS * COLS);
      a.solution.paths.forEach((p, w) => {
        expect(validPath(p, ROWS, COLS)).toBe(true);
        expect(spell(a.puzzle.letters, p)).toBe(a.solution.words[w]);
      });
      expect(a.puzzle).not.toHaveProperty("words");
      expect(JSON.stringify(a.puzzle)).not.toContain('"paths"');
    }
  }, 60000);

  it("free play picks entries from the seed", () => {
    const a = generate(createRng("free:1"), "easy");
    expect(generate(createRng("free:1"), "easy")).toEqual(a);
    expect(a.puzzle.ref.game).toBe("coil");
  });

  it("lays out 20+ entries with each theme word traceable in exactly one place", () => {
    let unique = 0;
    for (let i = 0; i < 24; i++) {
      const g = generateAt(i, i % 2 ? "medium" : "easy");
      if (countSolutions(g.puzzle, 2, g.solution.words) === 1) unique++;
    }
    expect(unique).toBeGreaterThanOrEqual(18);
  }, 60000);

  it("wraps indexes and grades harder layouts higher on average", () => {
    expect(generateAt(contentCount + 2, "easy").puzzle.theme).toBe(CONTENT[2].theme);
    expect(generateAt(-1, "easy").puzzle.theme).toBe(CONTENT[contentCount - 1].theme);
    const mean = (d: Difficulty) => Array.from({ length: 5 }, (_, i) => generateAt(i, d).grade).reduce((a, b) => a + b, 0) / 5;
    const e = mean("easy"),
      m = mean("medium"),
      h = mean("hard");
    expect(e).toBeLessThan(m);
    expect(m).toBeLessThan(h);
  }, 60000);

  it("layout fails cleanly when the words cannot tile the grid", () => {
    expect(layout(["ABCD"], 2, 3, createRng("x"), 0)).toBeNull();
    expect(grade([[0, 1, 2]], 5)).toBeGreaterThanOrEqual(0);
    expect(countSolutions(generateAt(0, "easy").puzzle, 2)).toBe(1);
  });

  it("tracings finds every distinct spot of a word", () => {
    const letters = ["A", "B", "A", "B"];
    expect(tracings(letters, 2, 2, "AB", 9).length).toBe(4);
  });
});

describe("coil guesses and verification", () => {
  const g = generateAt(0, "medium");
  const { puzzle, solution } = g;

  it("accepts a theme word on its path and reports why others fail", () => {
    const r = checkGuess(puzzle, solution, solution.paths[0]);
    expect(r).toEqual({ ok: true, index: 0, word: solution.words[0], path: solution.paths[0] });
    expect(checkGuess(puzzle, solution, [0, 29])).toEqual({ ok: false, reason: "path" });
    expect(checkGuess(puzzle, solution, "nope" as unknown as number[])).toEqual({ ok: false, reason: "path" });
    expect(checkGuess(puzzle, solution, [0]).ok).toBe(false);
    const short = solution.paths[0].slice(0, 3);
    expect(checkGuess(puzzle, solution, short)).toMatchObject({ ok: false, reason: "short" });
  });

  it("separates off-theme words, non-words and right words in the wrong spot", () => {
    // build a tiny puzzle by hand
    const p = { ...puzzle, rows: 2, cols: 4, letters: ["C", "A", "K", "E", "X", "Q", "Z", "J"], count: 1 };
    const s = { words: ["CAKE"], paths: [[0, 1, 2, 3]] };
    expect(checkGuess(p, s, [0, 1, 2, 3]).ok).toBe(true);
    expect(checkGuess(p, s, [5, 4, 1, 0])).toMatchObject({ ok: false, reason: "not-word" });
    const p2 = { ...p, letters: ["T", "A", "K", "E", "C", "A", "K", "E"] };
    const s2 = {
      words: ["CAKE", "TAKE"],
      paths: [
        [4, 5, 6, 7],
        [0, 1, 2, 3],
      ],
    };
    expect(checkGuess(p2, s2, [4, 1, 2, 3])).toMatchObject({ ok: false, reason: "spot" });
    const p3 = { ...p, letters: ["L", "A", "K", "E", "C", "A", "K", "E"] };
    const s3 = {
      words: ["CAKE", "WXYZ"],
      paths: [
        [4, 5, 6, 7],
        [0, 1, 2, 3],
      ],
    };
    expect(checkGuess(p3, s3, [0, 1, 2, 3])).toEqual({ ok: false, bonus: true, reason: "bonus", word: "LAKE" });
  });

  describe("bonus words", () => {
    const p = { ...puzzle, rows: 2, cols: 4, letters: ["L", "A", "K", "E", "C", "A", "K", "E"], count: 2 };
    const s = {
      words: ["CAKE", "WXYZ"],
      paths: [
        [4, 5, 6, 7],
        [0, 1, 2, 3],
      ],
    };

    it("counts a real off-theme word as a bonus, never as a found word or a mistake", () => {
      const r = checkGuess(p, s, [0, 1, 2, 3]);
      expect(r.ok).toBe(false);
      expect(r).toMatchObject({ bonus: true, word: "LAKE" });
      // a non-word and a theme word are never bonuses
      expect(checkGuess(p, s, [3, 2, 1, 0]).bonus).toBeUndefined();
      expect(checkGuess(p, s, [4, 5, 6, 7])).toMatchObject({ ok: true, word: "CAKE" });
      expect(bonusWords(p, s, { found: [], bonus: [[0, 1, 2, 3]] })).toEqual(["LAKE"]);
    });

    it("verify re-checks bonus words on the server and they never complete the puzzle", () => {
      const half = verify(p, s, { found: [[4, 5, 6, 7]], bonus: [[0, 1, 2, 3]] });
      expect(half).toMatchObject({ ok: false, reason: "incomplete" });
      expect(half.progress).toBeCloseTo(0.5);
      // older saves without the field still verify
      expect(verify(puzzle, solution, { found: solution.paths })).toEqual({ ok: true, progress: 1 });
      expect(verify(puzzle, solution, { found: solution.paths, bonus: [] })).toEqual({ ok: true, progress: 1 });
      // forged, repeated or malformed bonus entries are rejected
      expect(verify(p, s, { found: [[4, 5, 6, 7]], bonus: [[3, 2, 1, 0]] }).ok).toBe(false);
      expect(verify(p, s, { found: [[4, 5, 6, 7]], bonus: [[4, 5, 6, 7]] }).ok).toBe(false);
      expect(
        verify(p, s, {
          found: [[4, 5, 6, 7]],
          bonus: [
            [0, 1, 2, 3],
            [0, 1, 2, 3],
          ],
        }).ok,
      ).toBe(false);
      expect(verify(p, s, { found: [], bonus: "x" } as unknown as CoilState).ok).toBe(false);
      expect(bonusWords(p, s, { found: [] })).toEqual([]);
    });
  });

  it("rotating the view maps every cell back to the same coordinates and keeps neighbours", () => {
    for (let t = 0; t < 4; t++) {
      const [vr, vc] = viewDims(ROWS, COLS, t);
      expect(vr * vc).toBe(ROWS * COLS);
      const seen = new Set<number>();
      for (let i = 0; i < ROWS * COLS; i++) {
        const [r, c] = toView(i, ROWS, COLS, t);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(vr);
        expect(c).toBeLessThan(vc);
        expect(fromView(r, c, ROWS, COLS, t)).toBe(i);
        seen.add(r * vc + c);
        // a traced path stays a path: neighbours in the puzzle are neighbours on screen
        for (let j = 0; j < ROWS * COLS; j++) {
          const [r2, c2] = toView(j, ROWS, COLS, t);
          expect(Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1 && i !== j).toBe(adjacent(i, j, COLS));
        }
      }
      expect(seen.size).toBe(ROWS * COLS);
    }
    // a guess built from taps on a rotated view is the same guess as on the plain view
    const tapped = solution.paths[0].map((i) => toView(i, ROWS, COLS, 1)).map(([r, c]) => fromView(r, c, ROWS, COLS, 1));
    expect(checkGuess(puzzle, solution, tapped)).toMatchObject({ ok: true, index: 0 });
  });

  it("verifies the full set, rejects near misses and malformed state", () => {
    expect(verify(puzzle, solution, { found: solution.paths })).toEqual({ ok: true, progress: 1 });
    const part = verify(puzzle, solution, { found: solution.paths.slice(1) });
    expect(part.ok).toBe(false);
    expect(part.progress).toBeCloseTo((solution.words.length - 1) / solution.words.length);
    expect(verify(puzzle, solution, { found: [solution.paths[0], solution.paths[0]] }).ok).toBe(false);
    expect(verify(puzzle, solution, { found: [[0, 29]] }).ok).toBe(false);
    expect(verify(puzzle, solution, null as unknown as { found: number[][] }).ok).toBe(false);
    expect(verify(puzzle, solution, { found: "x" } as unknown as { found: number[][] }).ok).toBe(false);
    expect(progress(puzzle, solution, { found: [solution.paths[1]] })).toBeCloseTo(1 / solution.words.length);
    expect(progress(puzzle, solution, { found: [[1, 2]] })).toBe(0);
  });

  it("hints light up an unfound word without revealing its order, then run out", () => {
    const h = hint(puzzle, solution, { found: [] })!;
    const cells = h.target as number[];
    const w = solution.paths.findIndex((p) => sameCells(p, cells));
    expect(w).toBeGreaterThanOrEqual(0);
    expect(cells).toEqual(cells.slice().sort((a, b) => a - b));
    expect(h.text).not.toContain(solution.words[w]);
    expect(h.text).not.toMatch(/[–—]/);
    const after = hint(puzzle, solution, { found: [solution.paths[w]] })!;
    expect(sameCells(after.target as number[], solution.paths[w])).toBe(false);
    expect(hint(puzzle, solution, { found: solution.paths })).toBeNull();
    expect(hint(puzzle, solution, { found: [[0, 29]] })).not.toBeNull();
  });

  it("exposes the content logic contract", () => {
    expect(logic.id).toBe("coil");
    expect(logic.contentCount).toBe(contentCount);
    expect(adjacent(0, 6, COLS)).toBe(true);
    expect(adjacent(0, 0, COLS)).toBe(false);
  });
});
