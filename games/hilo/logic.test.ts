import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, { answer, CALLS, generate, hint, MAX_SLIPS, replay, show, SPEC, valueOf, verify, type Call, type Card } from "./logic";

const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const seeds = Array.from({ length: 24 }, (_, i) => `hilo-${i}`);
const perfect = (values: number[]): Call[] => Array.from({ length: CALLS }, (_, i) => answer(values, i));
const flip = (c: Call): Call => (c === "hi" ? "lo" : "hi");

describe("hilo", () => {
  it("evaluates and shows every card kind", () => {
    const cases: [Card, number, string][] = [
      [{ k: "n", a: 11 }, 11, "11"],
      [{ k: "add", a: 38, b: 27 }, 65, "38 + 27"],
      [{ k: "sub", a: 64, b: 19 }, 45, "64 − 19"],
      [{ k: "mul", a: 7, b: 8 }, 56, "7 × 8"],
      [{ k: "div", a: 72, b: 8 }, 9, "72 ÷ 8"],
      [{ k: "pct", a: 15, b: 80 }, 12, "15% of 80"],
      [{ k: "sq", a: 9 }, 81, "9²"],
      [{ k: "frac", a: 3, b: 4, c: 60 }, 45, "3/4 of 60"],
    ];
    for (const [c, v, s] of cases) {
      expect(valueOf(c)).toBe(v);
      expect(show(c)).toBe(s);
    }
  });

  for (const d of diffs) {
    it(`${d}: deterministic runs of whole, distinct-neighbour cards within the spec`, () => {
      const spec = SPEC[d];
      for (const seed of seeds) {
        const a = generate(createRng(seed), d);
        const b = generate(createRng(seed), d);
        expect(a).toEqual(b);
        const { cards } = a.puzzle;
        expect(cards).toHaveLength(CALLS + 1);
        expect(a.solution.values).toEqual(cards.map(valueOf));
        let run = 1;
        for (let i = 0; i < cards.length; i++) {
          const v = valueOf(cards[i]);
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(spec.range[0]);
          expect(v).toBeLessThanOrEqual(spec.range[1]);
          if (i === 0) continue;
          const gap = Math.abs(v - valueOf(cards[i - 1]));
          expect(gap).toBeGreaterThanOrEqual(spec.gap[0]);
          expect(gap).toBeLessThanOrEqual(spec.gap[1]);
          expect(cards[i].k).not.toBe(cards[i - 1].k);
          if (i >= 2) run = answer(a.solution.values, i - 1) === answer(a.solution.values, i - 2) ? run + 1 : 1;
          expect(run).toBeLessThanOrEqual(4);
        }
        expect(a.grade).toBeGreaterThanOrEqual(0);
        expect(a.grade).toBeLessThanOrEqual(100);
      }
    });

    it(`${d}: a perfect run verifies with score 10; slips lower the score; three slips fail`, () => {
      for (const seed of seeds) {
        const { puzzle, solution } = generate(createRng(seed), d);
        const best = perfect(solution.values);
        expect(verify(puzzle, solution, { calls: best })).toEqual({ ok: true, progress: 1, score: CALLS });
        const two = best.slice();
        two[1] = flip(two[1]);
        two[7] = flip(two[7]);
        expect(verify(puzzle, solution, { calls: two })).toMatchObject({ ok: true, score: CALLS - 2 });
        const three = best.slice(0, 3).map(flip);
        expect(verify(puzzle, solution, { calls: three })).toMatchObject({ ok: false, reason: "out of slips", score: 0 });
        // a call after the third slip is forged
        expect(verify(puzzle, solution, { calls: [...three, best[3]] }).ok).toBe(false);
        expect(verify(puzzle, solution, { calls: best.slice(0, 9) }).ok).toBe(false);
        expect(verify(puzzle, solution, { calls: [...best, "hi"] }).ok).toBe(false);
        expect(verify(puzzle, solution, { calls: ["up" as Call] }).ok).toBe(false);
        expect(verify(puzzle, solution, null as never).ok).toBe(false);
        expect(logic.progress(puzzle, solution, { calls: best.slice(0, 4) })).toBeCloseTo(0.4);
      }
    });

    it(`${d}: hints name the value of the card in play and never a past or later card`, () => {
      for (const seed of seeds.slice(0, 10)) {
        const { puzzle, solution } = generate(createRng(seed), d);
        const best = perfect(solution.values);
        for (let k = 0; k < CALLS; k++) {
          const h = hint(puzzle, solution, k === 0 ? undefined : { calls: best.slice(0, k) })!;
          expect(h).not.toBeNull();
          expect(h.target).toEqual({ card: k + 1, value: solution.values[k + 1] });
          expect(h.text.startsWith(`${show(puzzle.cards[k + 1])} = ${solution.values[k + 1]}.`)).toBe(true);
          expect(h.text).toContain(`Compare it with ${solution.values[k]}.`);
          expect(h.text).not.toMatch(/ - | — /);
        }
        expect(hint(puzzle, solution, { calls: best })).toBeNull();
        expect(hint(puzzle, solution, { calls: best.slice(0, MAX_SLIPS).map(flip) })).toBeNull();
      }
    });
  }

  it("replay counts slips and stops the run at the third", () => {
    const values = [10, 20, 15, 30, 25, 40, 35, 50, 45, 60, 55];
    expect(replay(values, ["hi", "lo", "lo"])).toMatchObject({ right: 2, slips: 1, over: false });
    expect(replay(values, ["lo", "hi", "lo"])).toMatchObject({ right: 0, slips: 3, over: true, failed: true, error: null });
  });
});
