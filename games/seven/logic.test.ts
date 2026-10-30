import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { wordSet } from "@/games/_shared/words";
import logic, { checkGuess, contentCount, generate, generateAt, grade, hint, maxScore, progress, TARGET, verify } from "./logic";
import { CONTENT, needsReview } from "./content";
import { answersFrom, isPangram, rankFor, RANKS, shapeError, wordScore } from "./rules";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

describe("seven content", () => {
  it("has 60 distinct sets, each with a Spuzl word and a fair number of answers", () => {
    expect(needsReview).toBe(true);
    expect(CONTENT.length).toBeGreaterThanOrEqual(60);
    const keys = new Set<string>();
    for (const e of CONTENT) {
      const letters = e.letters.split("");
      expect(new Set([e.centre, ...letters]).size).toBe(7);
      expect([e.centre, ...letters].join("")).not.toContain("S");
      const key = [e.centre, ...letters].sort().join("");
      expect(keys.has(key)).toBe(false);
      keys.add(key);
      const ans = answersFrom(wordSet(), e.centre, letters);
      expect(ans).toContain(e.pangram);
      expect(ans.length).toBeGreaterThanOrEqual(15);
      expect(ans.length).toBeLessThanOrEqual(60);
    }
  });
});

describe("seven generator", () => {
  it("is deterministic and sends letters and totals, never the words", () => {
    for (const d of DIFFS) {
      const g = generateAt(2, d);
      expect(generateAt(2, d)).toEqual(g);
      expect(g.puzzle.total).toBe(g.solution.words.length);
      expect(g.puzzle.target).toBe(Math.ceil(g.puzzle.maxScore * TARGET[d]));
      expect(JSON.stringify(g.puzzle)).not.toContain(CONTENT[2].pangram);
    }
    expect(generate(createRng("z"), "medium")).toEqual(generate(createRng("z"), "medium"));
    expect(generateAt(contentCount + 3, "easy").puzzle.centre).toBe(CONTENT[3].centre);
    expect(generateAt(-1, "easy").puzzle.centre).toBe(CONTENT[contentCount - 1].centre);
  });

  it("grades monotonically across difficulties", () => {
    for (let i = 0; i < 20; i++) {
      const gs = DIFFS.map((d) => generateAt(i, d).grade);
      for (let k = 1; k < gs.length; k++) expect(gs[k]).toBeGreaterThan(gs[k - 1]);
    }
    expect(grade(999, "mega")).toBeLessThanOrEqual(100);
  });
});

describe("seven words, scoring and verification", () => {
  const { puzzle, solution } = generateAt(0, "medium");
  const pg = solution.words.find((w) => isPangram(w, puzzle.centre, puzzle.letters))!;
  const four = solution.words.find((w) => w.length === 4)!;

  it("scores 1 for four letters, length otherwise, plus 7 for a Spuzl word", () => {
    expect(wordScore("ABCD", false)).toBe(1);
    expect(wordScore("ABCDE", false)).toBe(5);
    expect(wordScore("ABCDEFG", true)).toBe(14);
    expect(checkGuess(puzzle, solution, pg)).toEqual({ ok: true, score: pg.length + 7, pangram: true });
    expect(checkGuess(puzzle, solution, four.toLowerCase())).toEqual({ ok: true, score: 1, pangram: false });
  });

  it("explains every rejection", () => {
    const other = "ABCDEFGHIJKLMNOPQRTUVWXYZ".split("").find((l) => l !== puzzle.centre && !puzzle.letters.includes(l))!;
    expect(checkGuess(puzzle, solution, "ABC")).toEqual({ ok: false, reason: "short" });
    expect(checkGuess(puzzle, solution, puzzle.letters.slice(0, 4).join(""))).toEqual({ ok: false, reason: "centre" });
    expect(checkGuess(puzzle, solution, puzzle.centre + other + other + other)).toEqual({ ok: false, reason: "letters" });
    expect(checkGuess(puzzle, solution, puzzle.centre.repeat(5))).toEqual({ ok: false, reason: "word" });
    expect(checkGuess(puzzle, solution, four, [four])).toEqual({ ok: false, reason: "dupe" });
    expect(checkGuess(puzzle, solution, 5 as never)).toEqual({ ok: false, reason: "word" });
    expect(shapeError("A", ["B"], "AB")).toBe("short");
  });

  it("verifies the score against the day's target", () => {
    const all = verify(puzzle, solution, { found: solution.words });
    expect(all.ok).toBe(true);
    expect(all.score).toBe(maxScore(solution.words, puzzle.centre, puzzle.letters));
    expect(all.progress).toBe(1);
    const low = verify(puzzle, solution, { found: [four] });
    expect(low).toMatchObject({ ok: false, score: 1, reason: "below target" });
    expect(verify(puzzle, solution, { found: [four, four] }).ok).toBe(false);
    expect(verify(puzzle, solution, { found: ["ZZZZ"] }).ok).toBe(false);
    expect(verify(puzzle, solution, null as never).ok).toBe(false);
    expect(progress(puzzle, solution, { found: [four] })).toBeGreaterThan(0);
    expect(progress(puzzle, solution, { found: ["Q"] })).toBe(0);
  });

  it("hints point at the Spuzl word first, then the shortest word left", () => {
    const h = hint(puzzle, solution, { found: [] })!;
    expect(h.text).toMatch(/^A Spuzl word starts/);
    expect(h.text).not.toContain(pg);
    const rest = solution.words.filter((w) => !isPangram(w, puzzle.centre, puzzle.letters));
    const h2 = hint(puzzle, solution, { found: solution.words.filter((w) => isPangram(w, puzzle.centre, puzzle.letters)) })!;
    expect((h2.target as { len: number }).len).toBe(Math.min(...rest.map((w) => w.length)));
    expect(hint(puzzle, solution, { found: solution.words })).toBeNull();
    expect(hint(puzzle, solution, null as never)).not.toBeNull();
  });

  it("ranks climb with the score", () => {
    expect(rankFor(0, 100).name).toBe(RANKS[0].name);
    expect(rankFor(100, 100).name).toBe(RANKS[RANKS.length - 1].name);
    expect(rankFor(5, 0).name).toBe(RANKS[0].name);
    expect(logic.id).toBe("seven");
  });
});
