import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { checkTimedAnswers, READ_FLOOR_MS, timedMisses } from "@/games/_shared/cluecave";
import type { GuessContext } from "@/games/_shared/guess";
import { checkGuessWith } from "@/lib/game/guess-check";
import { bindPuzzle } from "@/lib/game/guess-token";
import { isRaceGame } from "@/lib/multiplayer/games";
import logic, {
  audit,
  checkGuess,
  contentCount,
  FREE_BASE,
  generate,
  generateAt,
  gradeOf,
  hint,
  LIMIT_MS,
  NET_SLACK_MS,
  QUESTIONS,
  record,
  verify,
  type QuickfireCheck,
  type QuickfireGuess,
} from "./logic";
import { CONTENT, needsReview } from "./content";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

describe("quickfire content", () => {
  it("has at least 30 days of questions, each with a source and 4 distinct options", () => {
    expect(needsReview).toBe(true);
    expect(contentCount).toBeGreaterThanOrEqual(30);
    expect(new Set(CONTENT.map((c) => c.q)).size).toBe(CONTENT.length);
    for (const c of CONTENT) {
      expect(new Set([c.answer, ...c.wrong]).size).toBe(4);
      expect(c.source.length).toBeGreaterThan(3);
      for (const t of [c.q, c.answer, ...c.wrong, c.source]) expect(t).not.toMatch(/[–—]/);
    }
    const african = CONTENT.filter((c) => c.cat === "africa").length / CONTENT.length;
    expect(african).toBeGreaterThan(0.18);
  });
});

describe("quickfire generation", () => {
  it("is deterministic, places the answer correctly and never repeats on consecutive days", () => {
    for (let i = 0; i < 70; i++) {
      const a = generateAt(i);
      expect(generateAt(i)).toEqual(a);
      expect(a.puzzle.questions).toHaveLength(QUESTIONS);
      a.puzzle.questions.forEach((q, k) => {
        const item = CONTENT.find((c) => c.q === q.q)!;
        expect(q.choices[a.solution.correct[k]]).toBe(item.answer);
      });
      const next = new Set(generateAt(i + 1).puzzle.questions.map((q) => q.q));
      expect(a.puzzle.questions.some((q) => next.has(q.q))).toBe(false);
    }
  });

  it("ships no answer key: no sealed copy, no correct indexes, and a token in place of the content index", () => {
    for (const g of [generateAt(4), generate(createRng("qf:leak"), "medium")]) {
      expect(g.puzzle).not.toHaveProperty("sealed");
      expect(Object.keys(g.puzzle).sort()).toEqual(["limitMs", "questions", "ref"]);
      for (const q of g.puzzle.questions) expect(Object.keys(q).sort()).toEqual(["cat", "choices", "q"]);
      const served = bindPuzzle(g.puzzle, "player-1", { k: "a", a: "attempt-1" });
      expect(served.ref).toEqual({ game: "quickfire", t: expect.any(String) });
      const json = JSON.stringify(served);
      expect(json).not.toMatch(/"correct"|"sealed"|"answer"|"i":|"d":/);
    }
  });

  it("a content reference rebuilds its board: Daily days below FREE_BASE, free play seeds above", () => {
    const d = generateAt(7);
    expect(d.puzzle.ref).toEqual({ game: "quickfire", i: 7, d: "easy" });
    const f = generate(createRng("qf:ref"), "hard");
    const ref = f.puzzle.ref as { i: number; d: string };
    expect(ref.i).toBeGreaterThanOrEqual(FREE_BASE);
    expect(generateAt(ref.i, "hard")).toEqual(f);
  });

  it("free play respects levels and caps a category at two", () => {
    for (const d of D) {
      for (let k = 0; k < 20; k++) {
        const g = generate(createRng(`qf:${d}:${k}`), d);
        expect(generate(createRng(`qf:${d}:${k}`), d)).toEqual(g);
        expect(g.puzzle.questions).toHaveLength(QUESTIONS);
        const cats = g.puzzle.questions.map((q) => q.cat);
        for (const c of cats) expect(cats.filter((x) => x === c).length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("grades harder difficulties higher", () => {
    const avg = (d: Difficulty) => Array.from({ length: 20 }, (_, k) => generate(createRng(`g${k}`), d).grade).reduce((a, b) => a + b) / 20;
    expect(avg("easy")).toBeLessThan(avg("medium"));
    expect(avg("medium")).toBeLessThan(avg("hard"));
    expect(gradeOf([CONTENT[0]])).toBeGreaterThanOrEqual(10);
  });
});

describe("quickfire verify", () => {
  const g = generateAt(0);
  const c = g.solution.correct;
  const all = (ms: number) => ({ answers: c.map((pick) => ({ pick, ms })) });

  it("scores right answers with a speed bonus", () => {
    expect(verify(g.puzzle, g.solution, all(LIMIT_MS))).toEqual({ ok: true, progress: 1, score: 500 });
    expect(verify(g.puzzle, g.solution, all(3000)).score).toBe(5 * 140);
    const mixed = {
      answers: c.map((pick, i) =>
        i < 2 ? { pick: (pick + 1) % 4, ms: 2000 } : i === 2 ? { pick: null, ms: LIMIT_MS } : { pick, ms: 7500 },
      ),
    };
    expect(verify(g.puzzle, g.solution, mixed).score).toBe(2 * 125);
  });

  it("rejects malformed, unfinished and inhumanly fast answers", () => {
    expect(verify(g.puzzle, g.solution, { answers: all(5000).answers.slice(0, 4) }).progress).toBeCloseTo(0.8);
    expect(verify(g.puzzle, g.solution, { answers: all(5000).answers.slice(0, 4) }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, all(READ_FLOOR_MS - 1)).reason).toBe("faster than the human floor");
    expect(verify(g.puzzle, g.solution, all(LIMIT_MS + 1)).reason).toBe("answer time out of range");
    expect(verify(g.puzzle, g.solution, { answers: c.map(() => ({ pick: 9, ms: 2000 })) }).reason).toBe("malformed pick");
    expect(verify(g.puzzle, g.solution, { answers: c.map(() => ({ pick: null, ms: 2000 })) }).reason).toBe("timeout without the full time");
    expect(verify(g.puzzle, g.solution, { answers: c.map(() => null) } as never).reason).toBe("malformed answer");
    expect(verify(g.puzzle, g.solution, { answers: c.map(() => ({ pick: 0, ms: 1.5 })) }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as never).progress).toBe(0);
    expect(checkTimedAnswers("x", 5, 4, 1000)).toBe("malformed answers");
  });

  it("progress counts answers without revealing correctness", () => {
    const wrong = { answers: c.slice(0, 2).map((p) => ({ pick: (p + 1) % 4, ms: 4000 })) };
    const right = { answers: c.slice(0, 2).map((pick) => ({ pick, ms: 4000 })) };
    expect(logic.progress(g.puzzle, g.solution, wrong)).toBe(logic.progress(g.puzzle, g.solution, right));
  });

  it("the 50:50 hint strikes exactly two wrong options", () => {
    for (let q = 0; q < QUESTIONS; q++) {
      const h = hint(g.puzzle, g.solution, { answers: all(4000).answers.slice(0, q) })!;
      const t = h.target as { question: number; remove: number[] };
      expect(t.question).toBe(q);
      expect(t.remove).toHaveLength(2);
      expect(t.remove).not.toContain(c[q]);
    }
    expect(hint(g.puzzle, g.solution, all(4000))).toBeNull();
    expect((hint(g.puzzle, g.solution, null as never)!.target as { question: number }).question).toBe(0);
  });
});

describe("quickfire resume", () => {
  it("counts wrong and timed-out answers so a resumed run keeps its slips", () => {
    const correct = [0, 1, 2, 3, 0];
    expect(timedMisses([], correct)).toBe(0);
    expect(timedMisses([{ pick: 0, ms: 4000 }], correct)).toBe(0);
    expect(
      timedMisses(
        [
          { pick: 0, ms: 4000 },
          { pick: 2, ms: 4000 },
          { pick: null, ms: LIMIT_MS },
        ],
        correct,
      ),
    ).toBe(2);
  });
});

describe("quickfire answers on the server", () => {
  const g = generateAt(3);
  const c = g.solution.correct;
  const wrongOf = (q: number) => (c[q] + 1) % 4;

  /** One attempt's server side: the move log the guess route keeps, and a server clock the test moves. */
  function attempt() {
    const log: unknown[] = [];
    let now = 1_000_000;
    const send = (guess: QuickfireGuess) => {
      const ctx: GuessContext = { kind: "attempt", state: null, log };
      const out = checkGuessWith(logic, g.puzzle, g.solution, guess, ctx, now);
      if (out.entry) log.push(out.entry);
      return out.result as QuickfireCheck;
    };
    return { log, send, wait: (ms: number) => (now += ms) };
  }
  const verdictOf = (r: QuickfireCheck) => (r.ok ? r.verdict : undefined);

  it("opens a question, then judges the answer with the server's time and records both", () => {
    const a = attempt();
    expect(a.send({ q: 0, open: true })).toEqual({ ok: true, leftMs: LIMIT_MS });
    a.wait(4000);
    expect(verdictOf(a.send({ q: 0, pick: c[0], ms: 3900 }))).toEqual({
      q: 0,
      pick: c[0],
      ms: 3900,
      right: true,
      answer: c[0],
      late: false,
    });
    expect(a.log).toEqual([
      { q: 0, open: true, t: 1_000_000 },
      { q: 0, pick: c[0], ms: 3900, late: false, t: 1_004_000 },
    ]);
    a.send({ q: 1, open: true });
    a.wait(2000);
    expect(verdictOf(a.send({ q: 1, pick: wrongOf(1), ms: 2000 }))).toMatchObject({ right: false, answer: c[1], pick: wrongOf(1) });
  });

  it("never gives the answer before the question is answered, and refuses questions out of order", () => {
    const a = attempt();
    const open = a.send({ q: 0, open: true });
    expect(JSON.stringify(open)).not.toMatch(/answer|right|verdict/);
    // Not opened yet, or not the next question: refused, nothing recorded.
    expect(a.send({ q: 1, open: true })).toEqual({ ok: false, refused: true });
    expect(a.send({ q: 1, pick: 0, ms: 2000 })).toEqual({ ok: false, refused: true });
    expect(a.log).toHaveLength(1);
    expect(a.send({ q: 0, pick: 7, ms: 2000 })).toEqual({ ok: false, invalid: true });
    expect(a.send({ q: 9, open: true })).toEqual({ ok: false, invalid: true });
    expect(a.send({ q: 0, pick: 0, ms: LIMIT_MS + 1 })).toEqual({ ok: false, invalid: true });
    expect(a.send(null as never)).toEqual({ ok: false, invalid: true });
  });

  it("an answer counts once: asking again returns the same verdict, whatever the new pick", () => {
    const a = attempt();
    a.send({ q: 0, open: true });
    a.wait(5000);
    const first = verdictOf(a.send({ q: 0, pick: wrongOf(0), ms: 5000 }));
    expect(first?.right).toBe(false);
    expect(verdictOf(a.send({ q: 0, pick: c[0], ms: 5000 }))).toEqual(first);
    // Re-opening an answered question catches a resumed board up with the verdict.
    expect(a.send({ q: 0, open: true })).toEqual({ ok: true, leftMs: 0, verdict: first });
    expect(a.log).toHaveLength(2);
  });

  it("refuses a late answer: past the window plus the network slack it counts as a timeout", () => {
    const a = attempt();
    a.send({ q: 0, open: true });
    a.wait(LIMIT_MS + NET_SLACK_MS + 1);
    expect(verdictOf(a.send({ q: 0, pick: c[0], ms: 14000 }))).toEqual({
      q: 0,
      pick: null,
      ms: LIMIT_MS,
      right: false,
      answer: c[0],
      late: true,
    });
    // Within the slack it still counts, its time no more than the slack under the server's measure.
    a.send({ q: 1, open: true });
    a.wait(LIMIT_MS + NET_SLACK_MS - 10);
    expect(verdictOf(a.send({ q: 1, pick: c[1], ms: 14900 }))).toMatchObject({ pick: c[1], ms: LIMIT_MS - 10, right: true, late: false });
  });

  it("scores the server's time: a claimed time far under its own measure is raised", () => {
    const a = attempt();
    a.send({ q: 0, open: true });
    a.wait(10_000);
    expect(verdictOf(a.send({ q: 0, pick: c[0], ms: READ_FLOOR_MS }))?.ms).toBe(10_000 - NET_SLACK_MS);
    // A reopen after the window started reports only the time left.
    a.send({ q: 1, open: true });
    a.wait(6000);
    expect(a.send({ q: 1, open: true })).toEqual({ ok: true, leftMs: LIMIT_MS - 6000 });
  });

  it("a timeout is judged at the full limit and shows the right option", () => {
    const a = attempt();
    a.send({ q: 0, open: true });
    a.wait(LIMIT_MS);
    expect(verdictOf(a.send({ q: 0, pick: null, ms: LIMIT_MS }))).toEqual({
      q: 0,
      pick: null,
      ms: LIMIT_MS,
      right: false,
      answer: c[0],
      late: false,
    });
  });

  it("finish takes the score from the server's record: forged or skipped answers fail the audit", () => {
    const a = attempt();
    const state = { answers: [] as { pick: number | null; ms: number }[] };
    for (let q = 0; q < QUESTIONS; q++) {
      a.send({ q, open: true });
      a.wait(3000);
      const v = verdictOf(a.send({ q, pick: q < 3 ? c[q] : wrongOf(q), ms: 3000 }))!;
      state.answers.push({ pick: v.pick, ms: v.ms });
    }
    expect(audit(g.puzzle, g.solution, state, a.log)).toBeNull();
    expect(verify(g.puzzle, g.solution, state)).toEqual({ ok: true, progress: 1, score: 3 * 140 });

    // Every answer right and fast, as a forged finish would claim: the server judged otherwise.
    const forged = { answers: c.map((pick) => ({ pick, ms: 500 })) };
    expect(verify(g.puzzle, g.solution, forged).ok).toBe(true);
    expect(audit(g.puzzle, g.solution, forged, a.log)).toBe("answer differs from the server's record");
    // A faster time than the server gave, a right pick in place of a wrong one, an answer it never judged.
    const faster = { answers: state.answers.map((x, i) => (i === 0 ? { ...x, ms: 400 } : x)) };
    expect(audit(g.puzzle, g.solution, faster, a.log)).toBe("answer differs from the server's record");
    expect(audit(g.puzzle, g.solution, forged, [])).toBe("answer the server never judged");
    expect(audit(g.puzzle, g.solution, { answers: state.answers.slice(0, 4) }, a.log)).toBe("judged answer missing from the state");
    // Extra display fields the board keeps (right, answer) don't matter.
    const shown = { answers: state.answers.map((x, i) => ({ ...x, right: i < 3, answer: c[i] })) };
    expect(audit(g.puzzle, g.solution, shown, a.log)).toBeNull();
  });

  it("practice (guided board, admin preview, dev fixture) judges at once; no context answers nothing", () => {
    const practice: GuessContext = { kind: "practice" };
    expect(checkGuess(g.puzzle, g.solution, { q: 2, open: true }, practice)).toEqual({ ok: true, leftMs: LIMIT_MS });
    expect(checkGuess(g.puzzle, g.solution, { q: 2, pick: c[2], ms: 100 }, practice)).toEqual({
      ok: true,
      verdict: { q: 2, pick: c[2], ms: READ_FLOOR_MS, right: true, answer: c[2], late: false },
    });
    // A race round or a bare reference: nothing is judged, so no answer leaks.
    expect(checkGuess(g.puzzle, g.solution, { q: 0, pick: 0, ms: 2000 }, null)).toEqual({ ok: false, refused: true });
    expect(checkGuess(g.puzzle, g.solution, { q: 0, open: true })).toEqual({ ok: false, refused: true });
  });

  it("records nothing for refused or repeated requests", () => {
    const refused: QuickfireCheck = { ok: false, refused: true };
    expect(record(g.puzzle, g.solution, { q: 0, open: true }, refused, [])).toBeNull();
    const log = [{ q: 0, open: true, t: 1 }];
    expect(record(g.puzzle, g.solution, { q: 0, open: true }, { ok: true, leftMs: 1000 }, log)).toBeNull();
  });

  it("is never a race game: a race round has no move log to judge answers on", () => {
    expect(isRaceGame("quickfire")).toBe(false);
  });
});
