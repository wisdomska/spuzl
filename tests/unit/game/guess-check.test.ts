import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { PRACTICE } from "@/games/_shared/guess";
import { checkGuessWith, finalVerdict, samePuzzleRef } from "@/lib/game/guess-check";
import five from "@/games/five/logic";
import seven from "@/games/seven/logic";
import type { GameLogic } from "@/games/types";

describe("guess transport server steps", () => {
  it("records only for an attempt, stamping entries with the server time", () => {
    const { puzzle, solution } = five.generateAt(2, "easy");
    const word = "CRANE" === solution.answer ? "PLUMB" : "CRANE";
    expect(checkGuessWith(five, puzzle, solution, word, null).entry).toBeNull();
    expect(checkGuessWith(five, puzzle, solution, word, PRACTICE).entry).toBeNull();
    expect(checkGuessWith(five, puzzle, solution, word, { kind: "attempt", state: null, log: [] }, 42).entry).toEqual({ w: word, t: 42 });
    // a game without `record` keeps nothing
    const g = seven.generate(createRng("gc"), "easy");
    expect(checkGuessWith(seven, g.puzzle, g.solution, "ZZZZ", { kind: "attempt", state: null, log: [] }).entry).toBeNull();
  });

  it("passes the context through without breaking games that take their own 4th argument", () => {
    const g = seven.generate(createRng("gc2"), "easy");
    const w = g.solution.words[0];
    expect(seven.checkGuess(g.puzzle, g.solution, w, { kind: "attempt", state: null, log: [] })).toMatchObject({ ok: true });
  });

  it("matches the practice board by its content reference", () => {
    const { puzzle } = five.generateAt(7, "easy");
    expect(samePuzzleRef(puzzle, { game: "five", i: 7, d: "easy" })).toBe(true);
    expect(samePuzzleRef(puzzle, { game: "five", i: 7, d: "hard" })).toBe(false);
    expect(samePuzzleRef(puzzle, { game: "five", i: 8, d: "easy" })).toBe(false);
    expect(samePuzzleRef(null, { game: "five", i: 7, d: "easy" })).toBe(false);
    expect(samePuzzleRef({}, { game: "five", i: 7, d: "easy" })).toBe(false);
  });

  it("fails a verified clear when the audit finds a reason, and leaves games without one alone", () => {
    const base: GameLogic = {
      id: "x",
      generate: () => ({ puzzle: 0, solution: 0, grade: 0 }),
      verify: () => ({ ok: true, progress: 1 }),
      progress: () => 1,
    };
    expect(finalVerdict(base, 0, 0, 0, []).verdict.ok).toBe(true);
    const audited: GameLogic = { ...base, audit: (_p, _s, _st, log) => (log.length ? "seen" : null) };
    expect(finalVerdict(audited, 0, 0, 0, []).verdict.ok).toBe(true);
    expect(finalVerdict(audited, 0, 0, 0, [{}]).verdict).toEqual({ ok: false, progress: 1, reason: "seen" });
    const failing: GameLogic = { ...audited, verify: () => ({ ok: false, progress: 0.5, reason: "incomplete" }) };
    expect(finalVerdict(failing, 0, 0, 0, [{}]).verdict.reason).toBe("incomplete");
  });
});
