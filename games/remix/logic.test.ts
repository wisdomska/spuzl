import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { isWord } from "@/games/_shared/words";
import logic, { checkGuess, contentCount, generate, generateAt, grade, hint, progress, scramble, verify } from "./logic";
import { CONTENT, needsReview } from "./content";
import { isAnagram, sortLetters } from "./rules";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

describe("remix content", () => {
  it("has 60 days of three real words, 5, 6 and 7 letters, never repeated", () => {
    expect(needsReview).toBe(true);
    expect(CONTENT.length).toBeGreaterThanOrEqual(60);
    const all = CONTENT.flatMap((e) => e.words);
    expect(new Set(all).size).toBe(all.length);
    for (const e of CONTENT) {
      expect(e.words.map((w) => w.length)).toEqual([5, 6, 7]);
      for (const w of e.words) expect(isWord(w), w).toBe(true);
    }
  });
});

describe("remix generator", () => {
  it("scrambles every word into a non-word that keeps the letters", () => {
    for (const d of DIFFS) {
      for (let i = 0; i < contentCount; i += 3) {
        const g = generateAt(i, d);
        g.puzzle.rounds.forEach((r, k) => {
          const w = g.solution.words[k];
          expect(sortLetters(r.letters)).toBe(sortLetters(w));
          expect(r.letters.join("")).not.toBe(w);
        });
        expect(JSON.stringify(g.puzzle)).not.toContain(g.solution.words[2]);
      }
    }
    expect(scramble("AAAA", createRng("x")).join("")).toBe("AAAA");
  });

  it("is deterministic, wraps and grades up with difficulty", () => {
    expect(generateAt(3, "hard")).toEqual(generateAt(3, "hard"));
    expect(generateAt(contentCount + 3, "hard").solution).toEqual(generateAt(3, "hard").solution);
    expect(generateAt(-1, "hard").solution.words).toEqual(CONTENT[contentCount - 1].words);
    expect(generate(createRng("r"), "easy")).toEqual(generate(createRng("r"), "easy"));
    expect(generateAt(0, "easy").puzzle.starts).toEqual(CONTENT[0].words.map((w) => w[0]));
    for (let i = 0; i < 20; i++) {
      const gs = DIFFS.map((d) => generateAt(i, d).grade);
      for (let k = 1; k < gs.length; k++) expect(gs[k]).toBeGreaterThan(gs[k - 1]);
    }
    expect(grade(["ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJ"], "mega")).toBe(100);
  });
});

describe("remix guesses and verification", () => {
  const { puzzle, solution } = generateAt(0, "medium");
  const w = solution.words;

  it("accepts the word or any real anagram, nothing else", () => {
    expect(checkGuess(puzzle, solution, { round: 0, word: w[0] })).toEqual({ ok: true });
    expect(checkGuess(puzzle, solution, { round: 0, word: w[0].toLowerCase() })).toEqual({ ok: true });
    expect(checkGuess(puzzle, solution, { round: 0, word: puzzle.rounds[0].letters.join("") })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, { round: 1, word: w[0] })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, { round: 5, word: w[0] })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, null as never)).toEqual({ ok: false });
    // a puzzle whose letters also spell another real word
    const p2 = { ...puzzle, rounds: [{ letters: ["T", "S", "O", "P"] }, ...puzzle.rounds.slice(1)] };
    expect(checkGuess(p2, { words: ["STOP", w[1], w[2]] }, { round: 0, word: "POTS" })).toEqual({ ok: true });
    expect(isAnagram(["A"], 5 as never)).toBe(false);
  });

  it("verifies three rounds in order and rejects near misses", () => {
    expect(verify(puzzle, solution, { answers: w })).toEqual({ ok: true, progress: 1 });
    expect(verify(puzzle, solution, { answers: w.slice(0, 2) })).toMatchObject({ ok: false, progress: 2 / 3 });
    expect(verify(puzzle, solution, { answers: [w[1], w[0], w[2]] }).ok).toBe(false);
    expect(verify(puzzle, solution, { answers: [...w, w[0]] }).ok).toBe(false);
    expect(verify(puzzle, solution, null as never).ok).toBe(false);
    expect(progress(puzzle, solution, { answers: [w[0]] })).toBeCloseTo(1 / 3);
    expect(progress(puzzle, solution, null as never)).toBe(0);
  });

  it("hints give the current word's start", () => {
    expect(hint(puzzle, solution, { answers: [] })!.text).toBe(`Round 1 starts with ${w[0][0]}.`);
    expect(hint(puzzle, solution, { answers: [w[0]] })!.text).toBe(`Round 2 starts with ${w[1][0]}.`);
    const easy = generateAt(0, "easy");
    expect(hint(easy.puzzle, easy.solution, { answers: [] })!.text).toBe(`Round 1 starts with ${easy.solution.words[0].slice(0, 2)}.`);
    expect(hint(puzzle, solution, { answers: w })).toBeNull();
    expect(hint(puzzle, solution, null as never)).not.toBeNull();
    expect(logic.id).toBe("remix");
  });
});
