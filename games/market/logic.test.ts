import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  basketCost,
  clueHolds,
  costOf,
  countSolutions,
  generate,
  hint,
  MAX_Q,
  ruleStatus,
  solve,
  SPEC,
  spendOf,
  verify,
  type MarketPuzzle,
  type MarketState,
} from "./logic";

const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const seeds = Array.from({ length: 22 }, (_, i) => `market-${i}`);

const tiny: MarketPuzzle = {
  items: [
    { key: "kenkey", price: 5, deal: false },
    { key: "yam", price: 12, deal: false },
  ],
  cash: 50,
  change: 1,
  clues: [{ k: "more", i: 0, j: 1 }],
};

describe("market", () => {
  it("prices the buy 3, get 1 free deal", () => {
    const item = { key: "egg" as const, price: 2, deal: true };
    expect([1, 2, 3, 4, 5, 8].map((q) => costOf(item, q))).toEqual([2, 4, 6, 6, 8, 12]);
  });

  it("solves a tiny list: 5 kenkey + 2 yams = 49 is the one basket with more kenkey", () => {
    // 5a + 12b = 49 has one answer in 1..9: b = 2, a = 5
    expect(solve(tiny, 10)).toEqual([[5, 2]]);
    expect(countSolutions(tiny, 10)).toBe(1);
    expect(countSolutions({ ...tiny, clues: [] }, 10)).toBe(1);
    expect(clueHolds({ k: "more", i: 0, j: 1 }, [5, null])).toBeNull();
    expect(ruleStatus(tiny, [9, 9])).toEqual([false, false]);
  });

  for (const d of diffs) {
    it(`${d}: deterministic, unique, within spec`, () => {
      const spec = SPEC[d];
      for (const seed of seeds) {
        const a = generate(createRng(seed), d);
        expect(generate(createRng(seed), d)).toEqual(a);
        const { puzzle: p, solution: s } = a;
        expect(p.items.length).toBeGreaterThanOrEqual(spec.items[0]);
        expect(p.items.length).toBeLessThanOrEqual(spec.items[1]);
        expect(p.clues.length).toBeLessThanOrEqual(spec.maxClues);
        expect(p.items.some((x) => x.deal)).toBe(spec.deal);
        expect(p.change).toBeGreaterThan(0);
        expect(basketCost(p, s.qty)).toBe(spendOf(p));
        expect(countSolutions(p, 5)).toBe(1);
        expect(solve(p, 5)).toEqual([s.qty]);
        // the spend rule alone never settles it, and every rule is needed
        expect(countSolutions({ ...p, clues: [] }, 2)).toBe(2);
        for (let k = 0; k < p.clues.length; k++) expect(countSolutions({ ...p, clues: p.clues.filter((_, x) => x !== k) }, 2)).toBe(2);
        expect(a.grade).toBeGreaterThanOrEqual(0);
        expect(a.grade).toBeLessThanOrEqual(100);
      }
    });

    it(`${d}: the answer verifies and near misses do not`, () => {
      for (const seed of seeds) {
        const { puzzle: p, solution: s } = generate(createRng(seed), d);
        expect(verify(p, s, { qty: s.qty })).toEqual({ ok: true, progress: 1 });
        for (let i = 0; i < p.items.length; i++) {
          const q = s.qty.slice();
          q[i] = q[i] === MAX_Q ? q[i] - 1 : q[i] + 1;
          expect(verify(p, s, { qty: q }).ok).toBe(false);
        }
        const part: (number | null)[] = s.qty.slice();
        part[0] = null;
        expect(verify(p, s, { qty: part })).toMatchObject({ ok: false, reason: "basket not full" });
        expect(logic.progress(p, s, { qty: part })).toBeCloseTo((p.items.length - 1) / p.items.length);
        expect(verify(p, s, { qty: s.qty.map(() => 0) }).ok).toBe(false);
        expect(verify(p, s, { qty: [...s.qty, 1] }).ok).toBe(false);
        expect(verify(p, s, null as never).ok).toBe(false);
        expect(ruleStatus(p, s.qty).every((x) => x === true)).toBe(true);
      }
    });

    it(`${d}: hints are safe, one item at a time, and lead to the answer`, () => {
      for (const seed of seeds.slice(0, 12)) {
        const { puzzle: p, solution: s } = generate(createRng(seed), d);
        let state: MarketState | undefined;
        for (let step = 0; step < p.items.length; step++) {
          const h = hint(p, s, state)!;
          const tg = h.target as { item: number; value: number };
          expect(tg.value).toBe(s.qty[tg.item]);
          expect(h.text).toMatch(/\.$/);
          expect(h.text).not.toMatch(/ - | — /);
          const qty: (number | null)[] = state?.qty.slice() ?? p.items.map(() => null);
          expect(qty[tg.item]).toBeNull();
          qty[tg.item] = tg.value;
          state = { qty };
        }
        expect(verify(p, s, state!).ok).toBe(true);
        expect(hint(p, s, state)).toBeNull();
        // a wrong count is pointed out first
        const bad: (number | null)[] = p.items.map(() => null);
        bad[1] = s.qty[1] === 1 ? 2 : 1;
        expect(hint(p, s, { qty: bad })!.target).toEqual({ item: 1, clear: true });
      }
    });
  }
});
