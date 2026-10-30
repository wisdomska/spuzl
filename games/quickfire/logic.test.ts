import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { checkTimedAnswers, READ_FLOOR_MS, unseal } from "@/games/_shared/cluecave";
import logic, { contentCount, generate, generateAt, gradeOf, hint, LIMIT_MS, QUESTIONS, sealKey, verify } from "./logic";
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

  it("seals the answer key and never ships it in plain text", () => {
    const g = generateAt(4);
    expect(unseal<number[]>(g.puzzle.sealed, sealKey(g.puzzle.ref))).toEqual(g.solution.correct);
    expect(JSON.stringify(g.puzzle)).not.toContain("correct");
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
