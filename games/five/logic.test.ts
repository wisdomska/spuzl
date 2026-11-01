import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { isWord } from "@/games/_shared/words";
import type { Difficulty } from "@/games/types";
import { PRACTICE, type GuessContext } from "@/games/_shared/guess";
import { checkGuessWith, finalVerdict } from "@/lib/game/guess-check";
import logic, { audit, checkGuess, contentCount, generate, generateAt, grade, hint, progress, record, verify } from "./logic";
import { ANSWERS, needsReview } from "./content";
import { HIT, letterMarks, markGuess, MISS, NEAR, TRIES, type FiveState } from "./rules";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

/** Six real five-letter words, none of them `answer`. */
function misses(answer: string): string[] {
  return ["CRANE", "PLUMB", "FIGHT", "WORDY", "SHOCK", "JUMPS", "VIXEN", "GLAZE"].filter((w) => w !== answer).slice(0, TRIES);
}

describe("five content", () => {
  it("has 500+ distinct uppercase answers, all in the dictionary", () => {
    expect(needsReview).toBe(true);
    expect(ANSWERS.length).toBeGreaterThanOrEqual(500);
    expect(new Set(ANSWERS).size).toBe(ANSWERS.length);
    for (const w of ANSWERS) {
      expect(w).toMatch(/^[A-Z]{5}$/);
      expect(isWord(w), w).toBe(true);
    }
  });
});

describe("five marks", () => {
  it("marks right spot, wrong spot and misses", () => {
    expect(markGuess("CRANE", "CRANE")).toEqual([HIT, HIT, HIT, HIT, HIT]);
    expect(markGuess("NACRE", "CRANE")).toEqual([NEAR, NEAR, NEAR, NEAR, HIT]);
    expect(markGuess("PLUMB", "CRANE")).toEqual([MISS, MISS, MISS, MISS, MISS]);
  });

  it("marks a doubled letter only as often as the answer has it", () => {
    // CRANE has one E and the last tile already claims it, so the other Es miss
    expect(markGuess("EERIE", "CRANE")).toEqual([MISS, MISS, NEAR, MISS, HIT]);
    expect(markGuess("SPEED", "ABIDE")).toEqual([MISS, MISS, NEAR, MISS, NEAR]);
    expect(markGuess("LLAMA", "HELLO")).toEqual([NEAR, NEAR, MISS, MISS, MISS]);
    expect(markGuess("ALLOW", "HELLO")).toEqual([MISS, NEAR, HIT, NEAR, MISS]);
  });

  it("keeps the best mark per letter for the keyboard", () => {
    const rows = [
      { word: "ALLOW", marks: markGuess("ALLOW", "HELLO") },
      { word: "HOLLY", marks: markGuess("HOLLY", "HELLO") },
    ];
    const k = letterMarks(rows);
    expect(k.L).toBe(HIT);
    expect(k.O).toBe(NEAR);
    expect(k.A).toBe(MISS);
    expect(k.H).toBe(HIT);
  });
});

describe("five generator", () => {
  it("is deterministic, never ships the answer, and keeps easy words free of repeats", () => {
    for (const d of DIFFS) {
      for (let s = 0; s < 25; s++) {
        const a = generate(createRng(`seed-${s}`), d);
        expect(generate(createRng(`seed-${s}`), d)).toEqual(a);
        expect(ANSWERS).toContain(a.solution.answer);
        expect(JSON.stringify(a.puzzle)).not.toContain(a.solution.answer);
        expect(a.puzzle.ref).toMatchObject({ game: "five", d });
        // the ref rebuilds the same answer (the guess route without an attempt)
        expect(generateAt(a.puzzle.ref.i, d).solution).toEqual(a.solution);
        if (d === "easy") expect(new Set(a.solution.answer).size).toBe(5);
        expect(a.grade).toBeGreaterThanOrEqual(0);
        expect(a.grade).toBeLessThanOrEqual(100);
      }
    }
    expect(generateAt(contentCount, "medium").solution).toEqual(generateAt(0, "medium").solution);
    expect(generateAt(-1, "medium").solution).toEqual(generateAt(contentCount - 1, "medium").solution);
  });

  it("does not repeat an answer on consecutive days", () => {
    for (const d of DIFFS) {
      for (let i = 0; i < 60; i++) expect(generateAt(i, d).solution.answer).not.toBe(generateAt(i + 1, d).solution.answer);
    }
  });

  it("grades harder days higher for the same word", () => {
    for (const w of ANSWERS.slice(0, 30)) {
      const gs = DIFFS.map((d) => grade(w, d));
      for (let k = 1; k < gs.length; k++) expect(gs[k]).toBeGreaterThan(gs[k - 1]);
    }
  });
});

describe("five guesses and verification", () => {
  for (const d of DIFFS) {
    it(`verifies clears and rejects wrong states (${d})`, () => {
      for (let s = 0; s < 20; s++) {
        const { puzzle, solution } = generate(createRng(`v-${d}-${s}`), d);
        const ans = solution.answer;
        const miss = misses(ans);
        expect(verify(puzzle, solution, { guesses: [ans] })).toEqual({ ok: true, progress: 1 });
        expect(verify(puzzle, solution, { guesses: [...miss.slice(0, 5), ans] }).ok).toBe(true);
        // seventh try, play after the clear, non-words and junk are all refused
        expect(verify(puzzle, solution, { guesses: [...miss, ans] }).ok).toBe(false);
        expect(verify(puzzle, solution, { guesses: [ans, miss[0]] }).ok).toBe(false);
        expect(verify(puzzle, solution, { guesses: ["QZXQZ", ans] }).ok).toBe(false);
        expect(verify(puzzle, solution, { guesses: [ans.toLowerCase()] }).ok).toBe(false);
        expect(verify(puzzle, solution, { guesses: miss })).toMatchObject({ ok: false, reason: "out of tries" });
        expect(verify(puzzle, solution, { guesses: [miss[0]] })).toMatchObject({ ok: false, reason: "incomplete" });
        expect(verify(puzzle, solution, null as unknown as FiveState).ok).toBe(false);
        expect(verify(puzzle, solution, { guesses: "CRANE" } as unknown as FiveState).ok).toBe(false);
        const p = progress(puzzle, solution, { guesses: [miss[0]] });
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(1);
      }
    });
  }

  it("checks words, refuses non-words without marks, and reveals only after six real misses", () => {
    const { puzzle, solution } = generateAt(3, "medium");
    const ans = solution.answer;
    expect(checkGuess(puzzle, solution, ans)).toEqual({ ok: true, word: ans, marks: [HIT, HIT, HIT, HIT, HIT] });
    expect(checkGuess(puzzle, solution, ans.toLowerCase())).toMatchObject({ ok: true });
    const m = misses(ans);
    expect(checkGuess(puzzle, solution, m[0])).toEqual({ ok: false, word: m[0], marks: markGuess(m[0], ans) });
    expect(checkGuess(puzzle, solution, "QZXQZ")).toEqual({ ok: false, invalid: "word" });
    expect(checkGuess(puzzle, solution, "CAT")).toEqual({ ok: false, invalid: "length" });
    expect(checkGuess(puzzle, solution, 42 as unknown as string)).toEqual({ ok: false, invalid: "length" });
    expect(checkGuess(puzzle, solution, { reveal: m }, PRACTICE)).toEqual({ reveal: ans });
    expect(checkGuess(puzzle, solution, { reveal: m.slice(0, 5) }, PRACTICE)).toEqual({ ok: false, refused: true });
    expect(checkGuess(puzzle, solution, { reveal: [...m.slice(0, 5), "QZXQZ"] }, PRACTICE)).toEqual({ ok: false, refused: true });
    expect(checkGuess(puzzle, solution, { reveal: [...m.slice(0, 5), ans] }, PRACTICE)).toEqual({ ok: false, refused: true });
  });

  it("shows the answer only for an attempt whose server log has the six misses, and never to a bare reference", () => {
    const { puzzle, solution } = generateAt(5, "hard");
    const ans = solution.answer;
    const m = misses(ans);
    // no context (a bare puzzle reference): refused even with a perfect proof
    expect(checkGuess(puzzle, solution, { reveal: m })).toEqual({ ok: false, refused: true });
    expect(checkGuess(puzzle, solution, { reveal: m }, null)).toEqual({ ok: false, refused: true });
    // an attempt: the proof must be words the server checked for it
    const at = (log: unknown[]): GuessContext => ({ kind: "attempt", state: { guesses: m }, log });
    const checked = m.map((w) => ({ w, t: 1 }));
    expect(checkGuess(puzzle, solution, { reveal: m }, at([]))).toEqual({ ok: false, refused: true });
    expect(checkGuess(puzzle, solution, { reveal: m }, at(checked.slice(0, 5)))).toEqual({ ok: false, refused: true });
    expect(checkGuess(puzzle, solution, { reveal: m }, at(checked))).toEqual({ reveal: ans });
  });

  it("keeps checked words and a shown answer on the attempt, and a shown answer fails the clear", () => {
    const { puzzle, solution } = generateAt(9, "medium");
    const ans = solution.answer;
    const m = misses(ans);
    // replaying the server route: each counted word is logged once (a resume re-sends them), non-words never
    let log: unknown[] = [];
    const send = (guess: Parameters<typeof checkGuess>[2]) => {
      const out = checkGuessWith(logic, puzzle, solution, guess, { kind: "attempt", state: null, log }, 7);
      if (out.entry) log = [...log, out.entry];
      return out.result;
    };
    for (const w of m.slice(0, 3)) send(w);
    for (const w of m.slice(0, 3)) send(w);
    send("QZXQZ");
    expect(log).toEqual(m.slice(0, 3).map((w) => ({ w, t: 7 })));
    expect(send({ reveal: m })).toEqual({ ok: false, refused: true });
    for (const w of m.slice(3)) send(w);
    expect(send({ reveal: m })).toEqual({ reveal: ans });
    expect(send({ reveal: m })).toEqual({ reveal: ans }); // asked again: shown again, logged once
    expect(log.filter((e) => (e as { reveal?: true }).reveal)).toHaveLength(1);
    // the cheat: six misses to see the answer, then claim a clean solve in five
    const forged: FiveState = { guesses: [...m.slice(0, 5), ans] };
    expect(verify(puzzle, solution, forged).ok).toBe(true);
    expect(audit(puzzle, solution, forged, log)).toMatch(/answer shown/);
    expect(finalVerdict(logic, puzzle, solution, forged, log).verdict.ok).toBe(false);
    // an honest clear with checked words only passes
    const honest = log.filter((e) => !(e as { reveal?: true }).reveal);
    expect(finalVerdict(logic, puzzle, solution, forged, honest).verdict.ok).toBe(true);
    expect(record(puzzle, solution, "QZXQZ", { ok: false, invalid: "word" }, [])).toBeNull();
  });

  it("hints show one true letter in an unfound spot, a new one each time", () => {
    for (let s = 0; s < 20; s++) {
      const { puzzle, solution } = generate(createRng(`h-${s}`), "medium");
      const ans = solution.answer;
      const h0 = hint(puzzle, solution, undefined as unknown as FiveState)!;
      expect(h0.target).toEqual({ pos: 0, letter: ans[0] });
      expect(h0.text).toContain(ans[0]);
      const guess = misses(ans)[0];
      const marks = markGuess(guess, ans);
      const h1 = hint(puzzle, solution, { guesses: [guess] })!;
      const t1 = h1.target as { pos: number; letter: string };
      expect(marks[t1.pos]).not.toBe(HIT);
      expect(t1.letter).toBe(ans[t1.pos]);
      const h2 = hint(puzzle, solution, { guesses: [guess], hinted: [t1.pos] })!;
      expect((h2.target as { pos: number }).pos).not.toBe(t1.pos);
      expect(hint(puzzle, solution, { guesses: [ans] })).toBeNull();
      expect(hint(puzzle, solution, { guesses: misses(ans) })).toBeNull();
      expect(hint(puzzle, solution, { guesses: [], hinted: [0, 1, 2, 3, 4] })).toBeNull();
    }
    expect(logic.id).toBe("five");
  });
});
