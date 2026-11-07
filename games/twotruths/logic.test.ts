import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { READ_FLOOR_MS } from "@/games/_shared/cluecave";
import { PRACTICE as PRACTICE_CTX, type GuessContext } from "@/games/_shared/guess";
import { bindPuzzle } from "@/lib/game/guess-token";
import { isRaceGame } from "@/lib/multiplayer/games";
import { TRUTHS_THEME_LABEL } from "@/lib/copy/twotruths";
import logic, {
  audit,
  checkGuess,
  contentCount,
  FREE_BASE,
  generate,
  generateAt,
  hint,
  LIMIT_MS,
  practice,
  PRACTICE_INDEX,
  record,
  ROUNDS,
  verify,
} from "./logic";
import { CONTENT, PRACTICE, needsReview } from "./content";
import { NET_SLACK_MS, TRUTHS_THEMES, type TruthsCheck, type TruthsGuess } from "./rules";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const DASH = /[–—]/;

describe("two truths content (R2-P5)", () => {
  it("has at least 60 fact-checked rounds, every theme, unique ids and statements, no dashes", () => {
    expect(needsReview).toBe(true);
    expect(CONTENT.length).toBeGreaterThanOrEqual(60);
    expect(new Set(CONTENT.map((r) => r.id)).size).toBe(CONTENT.length);
    const all = CONTENT.flatMap((r) => [...r.truths, r.lie]);
    expect(new Set(all).size).toBe(all.length);
    for (const t of TRUTHS_THEMES) {
      expect(TRUTHS_THEME_LABEL[t]).toBeTruthy();
      expect(CONTENT.filter((r) => r.theme === t).length, t).toBeGreaterThanOrEqual(6);
    }
    for (const r of [...CONTENT, ...PRACTICE]) {
      expect(r.source.length, r.id).toBeGreaterThan(3);
      expect(r.fix.length, r.id).toBeGreaterThan(3);
      for (const s of [...r.truths, r.lie, r.fix]) {
        expect(s, r.id).not.toMatch(DASH);
        expect(s.length, r.id).toBeLessThanOrEqual(110);
        expect(s.trim()).toBe(s);
      }
      expect([1, 2, 3]).toContain(r.level);
    }
  });
});

describe("two truths generation", () => {
  it("is deterministic, places the lie correctly and never repeats a round on consecutive days", () => {
    for (let i = 0; i < 40; i++) {
      const a = generateAt(i);
      expect(generateAt(i)).toEqual(a);
      expect(a.puzzle.rounds).toHaveLength(ROUNDS);
      a.puzzle.rounds.forEach((r, k) => {
        expect(r.statements).toHaveLength(3);
        const row = CONTENT.find((c) => c.lie === r.statements[a.solution.lie[k]])!;
        expect(row, `day ${i} round ${k}`).toBeDefined();
        expect(a.solution.fix[k]).toBe(row.fix);
        expect(new Set(r.statements)).toEqual(new Set([...row.truths, row.lie]));
      });
      const next = new Set(generateAt(i + 1).puzzle.rounds.flatMap((r) => r.statements));
      expect(a.puzzle.rounds.some((r) => r.statements.some((s) => next.has(s)))).toBe(false);
    }
    expect(contentCount).toBeGreaterThanOrEqual(12);
  });

  it("free play: 20+ seeds per difficulty, deterministic, at most two rounds per theme", () => {
    for (const d of D)
      for (let k = 0; k < 20; k++) {
        const g = generate(createRng(`tt:${d}:${k}`), d);
        expect(generate(createRng(`tt:${d}:${k}`), d)).toEqual(g);
        expect(g.puzzle.rounds).toHaveLength(ROUNDS);
        const themes = g.puzzle.rounds.map((r) => r.theme);
        for (const t of themes) expect(themes.filter((x) => x === t).length).toBeLessThanOrEqual(2);
        const ref = g.puzzle.ref as { i: number };
        expect(ref.i).toBeGreaterThanOrEqual(FREE_BASE);
        expect(generateAt(ref.i, d)).toEqual(g);
      }
  });

  it("puts the lie in every position, not always the same one", () => {
    const spots = new Set<number>();
    for (let i = 0; i < 20; i++) generateAt(i).solution.lie.forEach((l) => spots.add(l));
    expect([...spots].sort()).toEqual([0, 1, 2]);
  });

  it("ships no answer key: no lie index, no fix, and a token in place of the content index", () => {
    for (const g of [generateAt(3), generate(createRng("tt:leak"), "medium"), practice()]) {
      expect(Object.keys(g.puzzle).sort()).toEqual(["limitMs", "ref", "rounds"]);
      for (const r of g.puzzle.rounds) expect(Object.keys(r).sort()).toEqual(["statements", "theme"]);
      const served = bindPuzzle(g.puzzle, "player-1", { k: "a", a: "attempt-1" });
      expect(served.ref).toEqual({ game: "twotruths", t: expect.any(String) });
      const json = JSON.stringify(served);
      expect(json).not.toMatch(/"lie"|"fix"|"answer"|"i":|"d":/);
      for (const row of CONTENT) expect(json).not.toContain(row.fix);
    }
  });

  it("the practice board is two easy rounds outside the bank, the same for everyone", () => {
    const p = practice();
    expect(p).toEqual(practice());
    expect(p.puzzle.rounds).toHaveLength(PRACTICE.length);
    expect((p.puzzle.ref as { i: number }).i).toBe(PRACTICE_INDEX);
    expect(logic.practice).toBe(practice);
    for (const r of p.puzzle.rounds)
      for (const s of r.statements) expect(CONTENT.some((c) => [...c.truths, c.lie].includes(s))).toBe(false);
  });

  it("is a solo game: not raceable (Party races take time-scored live games only)", () => {
    expect(isRaceGame("twotruths")).toBe(false);
  });
});

describe("two truths verify and hint", () => {
  const g = generateAt(0);
  const lie = g.solution.lie;
  const all = (ms: number) => ({ answers: lie.map((pick) => ({ pick, ms })) });

  it("scores lies found with a speed bonus; wrong picks and timeouts score nothing", () => {
    expect(verify(g.puzzle, g.solution, all(LIMIT_MS))).toEqual({ ok: true, progress: 1, score: 500 });
    expect(verify(g.puzzle, g.solution, all(4000)).score).toBe(5 * 140);
    const mixed = {
      answers: lie.map((pick, i) =>
        i === 0 ? { pick: (pick + 1) % 3, ms: 3000 } : i === 1 ? { pick: null, ms: LIMIT_MS } : { pick, ms: LIMIT_MS },
      ),
    };
    expect(verify(g.puzzle, g.solution, mixed).score).toBe(300);
  });

  it("rejects unfinished, malformed and inhumanly fast runs", () => {
    expect(verify(g.puzzle, g.solution, { answers: all(5000).answers.slice(0, 3) }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, all(READ_FLOOR_MS - 1)).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { answers: lie.map(() => ({ pick: 3, ms: 4000 })) }).reason).toBe("malformed pick");
    expect(verify(g.puzzle, g.solution, null as never).ok).toBe(false);
  });

  it("the hint strikes one truth, never the lie", () => {
    for (let q = 0; q < ROUNDS; q++) {
      const h = hint(g.puzzle, g.solution, { answers: all(4000).answers.slice(0, q) })!;
      const t = h.target as { question: number; remove: number[] };
      expect(t.question).toBe(q);
      expect(t.remove).toHaveLength(1);
      expect(t.remove[0]).not.toBe(lie[q]);
      expect(h.text).not.toMatch(DASH);
    }
    expect(hint(g.puzzle, g.solution, all(4000))).toBeNull();
    expect(() => hint(g.puzzle, g.solution, undefined as never)).not.toThrow();
  });
});

describe("two truths server judging (guess transport)", () => {
  const g = generateAt(5);
  const lie = g.solution.lie;
  const ask = (guess: TruthsGuess, ctx: GuessContext) => checkGuess(g.puzzle, g.solution, guess, ctx);

  it("refuses bare references and malformed guesses", () => {
    expect(ask({ q: 0, open: true }, null)).toEqual({ ok: false, refused: true });
    expect(ask({ q: 9, open: true }, PRACTICE_CTX)).toEqual({ ok: false, invalid: true });
    expect(ask({ q: 0, pick: 3, ms: 1000 }, PRACTICE_CTX)).toEqual({ ok: false, invalid: true });
    expect(ask({ q: 0, pick: 0, ms: LIMIT_MS + 1 }, PRACTICE_CTX)).toEqual({ ok: false, invalid: true });
  });

  it("practice judges at once and sends the lie and what is true instead", () => {
    const r = ask({ q: 1, pick: lie[1], ms: 2500 }, PRACTICE_CTX) as Extract<TruthsCheck, { ok: true }>;
    expect(r.verdict).toMatchObject({ q: 1, right: true, answer: lie[1], ms: 2500, fix: g.solution.fix[1] });
  });

  it("an attempt goes in order, times on the server and keeps each answer once", () => {
    const log: unknown[] = [];
    const at = (now: number): GuessContext => ({ kind: "attempt", state: null, log, now });
    // answering before the round opened is refused
    expect(ask({ q: 0, pick: lie[0], ms: 4000 }, at(1000))).toEqual({ ok: false, refused: true });
    const open = ask({ q: 0, open: true }, at(1000));
    expect(open).toEqual({ ok: true, leftMs: LIMIT_MS });
    log.push({ ...(record(g.puzzle, g.solution, { q: 0, open: true }, open, log) as object), t: 1000 });
    // a claimed 400 ms is lifted to the server's measure less the slack
    const ans = ask({ q: 0, pick: lie[0], ms: 400 }, at(1000 + 9000)) as Extract<TruthsCheck, { ok: true }>;
    expect(ans.verdict).toMatchObject({ right: true, ms: 9000 - NET_SLACK_MS, late: false });
    const kept = record(g.puzzle, g.solution, { q: 0, pick: lie[0], ms: 400 }, ans, log);
    expect(kept).toEqual({ q: 0, pick: lie[0], ms: 9000 - NET_SLACK_MS, late: false });
    log.push(kept);
    // asking again returns the same verdict and records nothing
    const again = ask({ q: 0, pick: (lie[0] + 1) % 3, ms: 4000 }, at(20000)) as Extract<TruthsCheck, { ok: true }>;
    expect(again.verdict?.right).toBe(true);
    expect(record(g.puzzle, g.solution, { q: 0, pick: 0, ms: 4000 }, again, log)).toBeNull();
    // skipping ahead is refused
    expect(ask({ q: 2, open: true }, at(20000))).toEqual({ ok: false, refused: true });
    // a late answer counts as a timeout
    log.push({ q: 1, open: true, t: 30000 });
    const late = ask({ q: 1, pick: lie[1], ms: 1000 }, at(30000 + LIMIT_MS + NET_SLACK_MS + 1)) as Extract<TruthsCheck, { ok: true }>;
    expect(late.verdict).toMatchObject({ pick: null, ms: LIMIT_MS, late: true, right: false });
  });

  it("audit: the final state must match what the server judged", () => {
    const log = [
      { q: 0, open: true, t: 0 },
      { q: 0, pick: lie[0], ms: 5000, late: false },
    ];
    expect(audit(g.puzzle, g.solution, { answers: [{ pick: lie[0], ms: 5000 }] }, log)).toBeNull();
    expect(audit(g.puzzle, g.solution, { answers: [{ pick: lie[0], ms: 900 }] }, log)).toMatch(/differs/);
    expect(audit(g.puzzle, g.solution, { answers: [] }, log)).toMatch(/missing/);
    expect(
      audit(
        g.puzzle,
        g.solution,
        {
          answers: [
            { pick: lie[0], ms: 5000 },
            { pick: 0, ms: 5000 },
          ],
        },
        log,
      ),
    ).toMatch(/never judged/);
  });
});
