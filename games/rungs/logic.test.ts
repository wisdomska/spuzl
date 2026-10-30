import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { isWord } from "@/games/_shared/words";
import logic, { checkGuess, contentCount, countOrders, generate, generateAt, grade, hint, orientation, progress, verify } from "./logic";
import { CONTENT, needsReview } from "./content";
import { changedAt, diffCount, isPermutation, type RungsState } from "./rules";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

/** The finished state for a generated puzzle. */
function solved(s: { words: string[]; display: number[] }): RungsState {
  const answers = s.display.map((w) => s.words[w]);
  const order = [1, 2, 3, 4, 5].map((w) => s.display.indexOf(w));
  return { answers, order, caps: [s.words[0], s.words[6]] };
}

describe("rungs content", () => {
  it("has 60 ladders of real 4 letter words, one letter apart, with a unique rung order", () => {
    expect(needsReview).toBe(true);
    expect(CONTENT.length).toBeGreaterThanOrEqual(60);
    for (const e of CONTENT) {
      expect(e.words).toHaveLength(7);
      expect(e.clues).toHaveLength(7);
      e.words.forEach((w, i) => {
        expect(w).toMatch(/^[A-Z]{4}$/);
        expect(isWord(w), w).toBe(true);
        if (i) expect(diffCount(e.words[i - 1], w), `${e.words[i - 1]} ${w}`).toBe(1);
      });
      expect(countOrders(e.words), e.words.join(" ")).toBe(2);
      for (const c of e.clues) expect(c).not.toMatch(/[–—]/);
      e.words.forEach((w, i) => expect(e.clues[i].toUpperCase().split(/\W+/)).not.toContain(w));
    }
  });
});

describe("rungs generator", () => {
  it("is deterministic, hides the words and never shows the rungs in ladder order", () => {
    for (const d of DIFFS) {
      for (let i = 0; i < 20; i++) {
        const g = generateAt(i, d);
        expect(generateAt(i, d)).toEqual(g);
        const disp = g.solution.display.join("");
        expect(disp).not.toBe("12345");
        expect(disp).not.toBe("54321");
        const json = JSON.stringify(g.puzzle);
        for (const w of g.solution.words) expect(json).not.toContain(`"${w}"`);
        expect(!!g.puzzle.starts).toBe(d === "easy");
      }
    }
    expect(generate(createRng("x"), "medium")).toEqual(generate(createRng("x"), "medium"));
    expect(generateAt(contentCount + 1, "hard").solution).toEqual(generateAt(1, "hard").solution);
    expect(generateAt(-1, "hard").solution.words).toEqual(CONTENT[contentCount - 1].words);
  });

  it("grades monotonically across difficulties", () => {
    for (let i = 0; i < 20; i++) {
      const gs = DIFFS.map((d) => generateAt(i, d).grade);
      for (let k = 1; k < gs.length; k++) expect(gs[k]).toBeGreaterThan(gs[k - 1]);
    }
    expect(grade(["AAAA", "AAAB", "AABB", "ABBB", "BBBB", "BBBC", "BBCC"], "mega")).toBeLessThanOrEqual(100);
    expect(countOrders(["XXXX", "AAAA", "AAAB", "AABA", "ABAA", "BAAA", "YYYY"])).toBe(0);
  });
});

describe("rungs guesses and verification", () => {
  const { puzzle, solution } = generateAt(7, "medium");
  const done = solved(solution);

  it("checks rung answers, ladder order (either way up) and caps", () => {
    expect(checkGuess(puzzle, solution, { kind: "rung", rung: 0, word: done.answers[0] })).toEqual({ ok: true });
    expect(checkGuess(puzzle, solution, { kind: "rung", rung: 1, word: done.answers[0] })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, { kind: "rung", rung: 9, word: "ABCD" })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, { kind: "rung", rung: 0, word: "abcd" })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, { kind: "order", order: done.order })).toEqual({ ok: true, reversed: false });
    expect(checkGuess(puzzle, solution, { kind: "order", order: done.order.slice().reverse() })).toEqual({ ok: true, reversed: true });
    expect(checkGuess(puzzle, solution, { kind: "order", order: [0, 1, 2, 3, 4].filter((x) => x !== done.order[0]).concat(done.order[0]) }).ok).toBe(false);
    expect(checkGuess(puzzle, solution, { kind: "order", order: [0, 0, 1, 2, 3] })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, { kind: "cap", cap: 0, word: solution.words[0] })).toEqual({ ok: true });
    expect(checkGuess(puzzle, solution, { kind: "cap", cap: 1, word: solution.words[0] })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, { kind: "cap", cap: 2 as 0, word: solution.words[0] })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, { kind: "nope" } as never)).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, null as never)).toEqual({ ok: false });
  });

  it("verifies the full ladder and rejects near misses and junk", () => {
    expect(verify(puzzle, solution, done)).toEqual({ ok: true, progress: 1 });
    expect(verify(puzzle, solution, { ...done, caps: [done.caps[0], ""] })).toMatchObject({ ok: false, progress: 7 / 8 });
    expect(verify(puzzle, solution, { ...done, order: done.order.slice().reverse() }).ok).toBe(false);
    const wrong = { ...done, answers: done.answers.map((a, k) => (k === 0 ? "ZZZZ" : a)) };
    expect(verify(puzzle, solution, wrong).ok).toBe(false);
    expect(verify(puzzle, solution, { answers: [], order: [], caps: ["", ""] }).ok).toBe(false);
    expect(verify(puzzle, solution, null as never).ok).toBe(false);
    expect(progress(puzzle, solution, { answers: ["", "", "", "", ""], order: [0, 1, 2, 3, 4], caps: ["", ""] })).toBe(0);
    expect(orientation(solution, [1, 2])).toBe(-1);
  });

  it("hints walk rung letters, then ladder neighbours, then caps", () => {
    const empty: RungsState = { answers: ["", "", "", "", ""], order: [0, 1, 2, 3, 4], caps: ["", ""] };
    const h1 = hint(puzzle, solution, empty)!;
    expect(h1.text).toBe(`Rung 1 starts with ${done.answers[0][0]}.`);
    expect(h1.text).not.toContain(done.answers[0]);
    const h2 = hint(puzzle, solution, { ...empty, answers: done.answers })!;
    expect(h2.text).toMatch(/sits right next to/);
    const h2b = hint(puzzle, solution, { ...empty, answers: done.answers, order: "x" as never })!;
    expect(h2b.text).toMatch(/sits right next to/);
    const h3 = hint(puzzle, solution, { ...done, caps: ["", ""] })!;
    expect(h3.text).toBe(`The top word starts with ${solution.words[0][0]}.`);
    const h4 = hint(puzzle, solution, { ...done, caps: [done.caps[0], ""] })!;
    expect(h4.text).toBe(`The bottom word starts with ${solution.words[6][0]}.`);
    expect(hint(puzzle, solution, done)).toBeNull();
    expect(hint(puzzle, solution, { ...done, order: done.order.slice().reverse(), caps: done.caps })).toBeNull();
    expect(hint(puzzle, solution, { answers: "x", order: [], caps: "y" } as never)).not.toBeNull();
  });

  it("helpers behave", () => {
    expect(changedAt("CORD", "WORD")).toBe(0);
    expect(changedAt("CORD", "CORD")).toBe(-1);
    expect(changedAt("CORD", "WARD")).toBe(-1);
    expect(isPermutation([0, 1], 3)).toBe(false);
    expect(logic.id).toBe("rungs");
  });
});
