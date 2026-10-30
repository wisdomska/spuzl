import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { unseal } from "@/games/_shared/cluecave";
import logic, { contentCount, DAYS, generate, generateAt, hint, LIMIT_MS, MIX, ROUNDS, sealKey, verify } from "./logic";
import { CONTENT, needsReview } from "./content";
import { starPoints } from "./Flag";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const byName = new Map(CONTENT.map((c) => [c.name, c]));

describe("flagged content", () => {
  it("has unique countries, plausible flags and enough of each pool", () => {
    expect(needsReview).toBe(true);
    expect(byName.size).toBe(CONTENT.length);
    expect(CONTENT.filter((c) => c.flag).length).toBeGreaterThanOrEqual(MIX.flag * 2 * 5);
    for (const c of CONTENT) {
      for (const t of [c.name, c.capital ?? "", c.currency ?? ""]) expect(t).not.toMatch(/[–—]/);
      const f = c.flag;
      if (!f) continue;
      expect(f.w).toBeGreaterThan(0);
      if (f.kind === "h" || f.kind === "v") {
        expect(f.stripes.length).toBeGreaterThanOrEqual(2);
        if (f.weights) expect(f.weights).toHaveLength(f.stripes.length);
      }
      for (const e of f.emblems ?? []) {
        expect(e.cx - e.r).toBeGreaterThanOrEqual(0);
        expect(e.cx + e.r).toBeLessThanOrEqual(f.w);
        expect(e.cy + e.r).toBeLessThanOrEqual(f.h);
      }
    }
    const africa = CONTENT.filter((c) => c.continent === "africa").length / CONTENT.length;
    expect(africa).toBeGreaterThan(0.2);
  });

  it("draws a five pointed star with ten vertices", () => {
    expect(starPoints(1, 1, 1).split(" ")).toHaveLength(10);
    expect(starPoints(1, 1, 1).split(" ")[0]).toBe("1,0");
  });
});

describe("flagged generation", () => {
  it("builds 10 rounds with the daily mix, 4 distinct options and the answer in place", () => {
    expect(contentCount).toBe(DAYS);
    for (let i = 0; i < DAYS; i++) {
      const g = generateAt(i);
      expect(generateAt(i)).toEqual(g);
      expect(g.puzzle.rounds).toHaveLength(ROUNDS);
      for (const kind of ["flag", "capital", "currency"] as const) expect(g.puzzle.rounds.filter((r) => r.kind === kind)).toHaveLength(MIX[kind]);
      g.puzzle.rounds.forEach((r, k) => {
        expect(new Set(r.choices).size).toBe(4);
        const right = r.choices[g.solution.correct[k]];
        if (r.kind === "flag") expect(byName.get(right)!.flag).toEqual(r.flag);
        if (r.kind === "capital") expect(byName.get(r.country!)!.capital).toBe(right);
        if (r.kind === "currency") expect(byName.get(r.country!)!.currency).toBe(right);
      });
    }
  });

  it("never repeats an item on consecutive days", () => {
    const keys = (i: number) => new Set(generateAt(i).puzzle.rounds.map((r) => `${r.kind}:${r.country ?? JSON.stringify(r.flag)}`));
    for (let i = 0; i < DAYS; i++) {
      const a = keys(i), b = keys(i + 1);
      expect([...a].some((k) => b.has(k))).toBe(false);
    }
  });

  it("seals the answer key", () => {
    const g = generateAt(2);
    expect(unseal<number[]>(g.puzzle.sealed, sealKey(g.puzzle.ref))).toEqual(g.solution.correct);
  });

  it("free play is deterministic, always 10 rounds, and grades harder difficulties higher", () => {
    const avg: Record<string, number> = {};
    for (const d of D) {
      let t = 0;
      for (let k = 0; k < 20; k++) {
        const g = generate(createRng(`fg:${d}:${k}`), d);
        expect(generate(createRng(`fg:${d}:${k}`), d)).toEqual(g);
        expect(g.puzzle.rounds).toHaveLength(ROUNDS);
        t += g.grade;
      }
      avg[d] = t / 20;
    }
    expect(avg.easy).toBeLessThan(avg.medium);
    expect(avg.medium).toBeLessThan(avg.hard);
    expect(avg.hard).toBeLessThan(avg.expert);
  });
});

describe("flagged verify", () => {
  const g = generateAt(0);
  const c = g.solution.correct;
  const all = (ms: number) => ({ answers: c.map((pick) => ({ pick, ms })) });

  it("scores right answers with a speed bonus", () => {
    expect(verify(g.puzzle, g.solution, all(LIMIT_MS))).toEqual({ ok: true, progress: 1, score: 1000 });
    expect(verify(g.puzzle, g.solution, all(2000)).score).toBe(10 * 140);
    const wrong = { answers: c.map((p) => ({ pick: (p + 1) % 4, ms: 2000 })) };
    expect(verify(g.puzzle, g.solution, wrong).score).toBe(0);
  });

  it("rejects malformed, unfinished and inhumanly fast answers", () => {
    expect(verify(g.puzzle, g.solution, { answers: all(2000).answers.slice(0, 9) }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, all(100)).reason).toBe("faster than the human floor");
    expect(verify(g.puzzle, g.solution, null as never).progress).toBe(0);
    expect(logic.progress(g.puzzle, g.solution, { answers: all(2000).answers.slice(0, 5) })).toBe(0.5);
  });

  it("the 50:50 hint never strikes the answer", () => {
    for (let q = 0; q < ROUNDS; q++) {
      const t = hint(g.puzzle, g.solution, { answers: all(2000).answers.slice(0, q) })!.target as { question: number; remove: number[] };
      expect(t.question).toBe(q);
      expect(t.remove).toHaveLength(2);
      expect(t.remove).not.toContain(c[q]);
    }
    expect(hint(g.puzzle, g.solution, all(2000))).toBeNull();
    expect(hint(g.puzzle, g.solution, null as never)).not.toBeNull();
  });
});
