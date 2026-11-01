/**
 * Market Run: a Makola market shopping puzzle in cedis. A short list of items with unit prices (one may carry
 * "buy 3, get 1 free"), the cash in hand and the exact change to bring back, and a few rules ("more yams than
 * onions", "at least 2 kenkey balls"). Choose how many of each to buy, 1 to 9, so the basket costs exactly the
 * cash minus the change and every rule holds. The generator adds rules until exactly one basket fits, then drops
 * any rule the answer does not need. The server checks the basket against the rules (and the unique answer).
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { market as t, MARKET_ITEMS, type ItemKey } from "@/lib/copy/market";

export interface Item {
  key: ItemKey;
  price: number;
  /** buy 3, get 1 free: every 4th one costs nothing */
  deal: boolean;
}
export type Clue =
  | { k: "min"; i: number; n: number }
  | { k: "max"; i: number; n: number }
  | { k: "more"; i: number; j: number }
  | { k: "same"; i: number; j: number }
  | { k: "twice"; i: number; j: number }
  | { k: "count"; n: number };

export interface MarketPuzzle {
  items: Item[];
  /** cash in hand, cedis */
  cash: number;
  /** exact change to bring back */
  change: number;
  clues: Clue[];
}
export interface MarketSolution {
  qty: number[];
}
export interface MarketState {
  /** quantity per item, null while empty */
  qty: (number | null)[];
}

/** Quantities run 1 to 9 (at least one of everything on the list). */
export const MIN_Q = 1;
export const MAX_Q = 9;

/* ---------------- Pricing + rules ---------------- */

export const paidFor = (item: Item, q: number) => (item.deal ? q - Math.floor(q / 4) : q);
export const costOf = (item: Item, q: number) => item.price * paidFor(item, q);
export const spendOf = (p: MarketPuzzle) => p.cash - p.change;
export const basketCost = (p: MarketPuzzle, qty: (number | null)[]) =>
  p.items.reduce((s, it, i) => s + (qty[i] == null ? 0 : costOf(it, qty[i]!)), 0);

/** Items a clue reads. */
export const clueItems = (c: Clue): number[] => (c.k === "count" ? [] : "j" in c ? [c.i, c.j] : [c.i]);

/** true / false once every item the clue reads is filled (count: every item), null before. */
export function clueHolds(c: Clue, qty: (number | null)[]): boolean | null {
  if (c.k === "count") return qty.every((q) => q != null) ? qty.reduce<number>((s, q) => s + q!, 0) === c.n : null;
  const a = qty[c.i];
  if (a == null) return null;
  if (c.k === "min") return a >= c.n;
  if (c.k === "max") return a <= c.n;
  const b = qty[c.j];
  if (b == null) return null;
  if (c.k === "more") return a > b;
  if (c.k === "same") return a === b;
  return a === 2 * b;
}

export function clueText(p: MarketPuzzle, c: Clue): string {
  const key = (i: number) => p.items[i].key;
  switch (c.k) {
    case "min":
      return t.clue.min(key(c.i), c.n);
    case "max":
      return t.clue.max(key(c.i), c.n);
    case "more":
      return t.clue.more(key(c.i), key(c.j));
    case "same":
      return t.clue.same(key(c.i), key(c.j));
    case "twice":
      return t.clue.twice(key(c.i), key(c.j));
    case "count":
      return t.clue.count(c.n);
  }
}

/** Every rule on the list, the spend rule first. null entries are not settled yet. */
export function ruleStatus(p: MarketPuzzle, qty: (number | null)[]): (boolean | null)[] {
  const full = qty.every((q) => q != null);
  const cost = basketCost(p, qty);
  const spend = full ? cost === spendOf(p) : cost > spendOf(p) ? false : null;
  return [spend, ...p.clues.map((c) => clueHolds(c, qty))];
}

/* ---------------- Solver ---------------- */

/** Baskets that fit, stopping at `limit`. `fixed` pins some items (hint search). */
export function solve(p: MarketPuzzle, limit: number, fixed: (number | null)[] = []): number[][] {
  const n = p.items.length;
  const spend = spendOf(p);
  const out: number[][] = [];
  const q: (number | null)[] = Array(n).fill(null);
  // cheapest possible cost of items i.. (one each, or the pinned count)
  const rest = Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) rest[i] = rest[i + 1] + costOf(p.items[i], fixed[i] ?? MIN_Q);
  const rec = (i: number, cost: number) => {
    if (out.length >= limit) return;
    if (i === n) {
      if (cost === spend && p.clues.every((c) => clueHolds(c, q) === true)) out.push(q.slice() as number[]);
      return;
    }
    const lo = fixed[i] ?? MIN_Q,
      hi = fixed[i] ?? MAX_Q;
    for (let v = lo; v <= hi; v++) {
      const c = cost + costOf(p.items[i], v);
      if (c + rest[i + 1] > spend) break;
      q[i] = v;
      // prune on clues that are now settled
      if (p.clues.every((cl) => clueHolds(cl, q) !== false)) rec(i + 1, c);
      q[i] = null;
    }
  };
  rec(0, 0);
  return out;
}

export function countSolutions(p: MarketPuzzle, limit: number): number {
  return solve(p, limit).length;
}

/* ---------------- Generator ---------------- */

interface Spec {
  items: [number, number];
  /** target quantities range */
  q: [number, number];
  deal: boolean;
  maxClues: number;
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { items: [3, 3], q: [1, 5], deal: false, maxClues: 2 },
  medium: { items: [3, 4], q: [1, 6], deal: false, maxClues: 3 },
  hard: { items: [4, 4], q: [1, 6], deal: true, maxClues: 3 },
  expert: { items: [4, 4], q: [1, 8], deal: true, maxClues: 4 },
  mega: { items: [5, 5], q: [1, 8], deal: true, maxClues: 4 },
};

/** Makola price ranges in whole cedis (puzzle prices, not a price list). */
const PRICES: Record<ItemKey, [number, number]> = {
  kenkey: [3, 6],
  yam: [12, 25],
  plantain: [2, 5],
  tomato: [4, 8],
  onion: [1, 3],
  egg: [2, 3],
  bread: [8, 15],
  gari: [10, 20],
  fish: [10, 20],
  orange: [1, 3],
  shito: [15, 30],
  gardenEgg: [1, 3],
};
const KEYS = Object.keys(MARKET_ITEMS) as ItemKey[];

function candidates(q: number[]): Clue[] {
  const out: Clue[] = [];
  const n = q.length;
  for (let i = 0; i < n; i++) {
    if (q[i] >= 2) out.push({ k: "min", i, n: q[i] });
    if (q[i] >= 3) out.push({ k: "min", i, n: q[i] - 1 });
    if (q[i] <= MAX_Q - 1) out.push({ k: "max", i, n: q[i] });
    if (q[i] <= MAX_Q - 2) out.push({ k: "max", i, n: q[i] + 1 });
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (q[i] > q[j]) out.push({ k: "more", i, j }, { k: "more", i, j });
      if (q[i] === q[j] && i < j) out.push({ k: "same", i, j }, { k: "same", i, j });
      if (q[i] === 2 * q[j]) out.push({ k: "twice", i, j }, { k: "twice", i, j });
    }
  }
  out.push({ k: "count", n: q.reduce((s, x) => s + x, 0) });
  return out;
}

const sameClue = (a: Clue, b: Clue) => JSON.stringify(a) === JSON.stringify(b);

/** A min and a max on the same item at the same count just give the answer away. */
const pins = (clues: Clue[]) => clues.some((a) => a.k === "min" && clues.some((b) => b.k === "max" && b.i === a.i && b.n === a.n));

export function generate(rng: Rng, difficulty: Difficulty): Generated<MarketPuzzle, MarketSolution> {
  const spec = SPEC[difficulty];
  for (let attempt = 0; attempt < 400; attempt++) {
    const n = rng.int(spec.items[0], spec.items[1]);
    const keys = rng.shuffle(KEYS.slice()).slice(0, n);
    const items: Item[] = keys.map((key) => ({ key, price: rng.int(PRICES[key][0], PRICES[key][1]), deal: false }));
    if (new Set(items.map((x) => x.price)).size !== n) continue;
    const qty = items.map(() => rng.int(spec.q[0], spec.q[1]));
    if (spec.deal) {
      const d = rng.int(0, n - 1);
      items[d].deal = true;
      qty[d] = rng.int(4, Math.min(MAX_Q - 1, spec.q[1] + 1));
    }
    const spend = items.reduce((s, it, i) => s + costOf(it, qty[i]), 0);
    // cash is the next round note amount with some change left
    const step = spend < 60 ? 10 : spend < 150 ? 20 : 50;
    const cash = Math.ceil((spend + 1) / step) * step;
    const p: MarketPuzzle = { items, cash, change: cash - spend, clues: [] };
    if (countSolutions(p, 2) < 2) continue; // the spend rule alone settles it: no puzzle
    const pool = rng.shuffle(candidates(qty));
    for (const c of pool) {
      if (p.clues.some((x) => sameClue(x, c))) continue;
      const before = countSolutions(p, 1000);
      p.clues.push(c);
      const after = countSolutions(p, 1000);
      if (after >= before) p.clues.pop();
      if (after === 1) break;
    }
    if (countSolutions(p, 2) !== 1) continue;
    // drop rules the answer does not need
    for (let k = p.clues.length - 1; k >= 0; k--) {
      const without = { ...p, clues: p.clues.filter((_, x) => x !== k) };
      if (countSolutions(without, 2) === 1) p.clues = without.clues;
    }
    if (p.clues.length > spec.maxClues || pins(p.clues)) continue;
    return { puzzle: p, solution: { qty }, grade: grade(p) };
  }
  throw new Error(`market: could not generate a ${difficulty} puzzle`);
}

/** 0..100 from items, rules, the deal and how many baskets the spend rule alone allows. */
export function grade(p: MarketPuzzle): number {
  const open = countSolutions({ ...p, clues: [] }, 200);
  return Math.max(
    0,
    Math.min(
      100,
      Math.round((p.items.length - 3) * 15 + p.clues.length * 12 + (p.items.some((x) => x.deal) ? 15 : 0) + Math.log2(open) * 4),
    ),
  );
}

/* ---------------- Verification ---------------- */

const wellFormed = (p: MarketPuzzle, s: unknown): s is MarketState =>
  !!s &&
  typeof s === "object" &&
  Array.isArray((s as MarketState).qty) &&
  (s as MarketState).qty.length === p.items.length &&
  (s as MarketState).qty.every((q) => q === null || (Number.isInteger(q) && q >= MIN_Q && q <= MAX_Q));

/** Filled share of the list (never correctness, so it leaks nothing). */
export function progress(p: MarketPuzzle, _sol: MarketSolution, state: MarketState): number {
  if (!wellFormed(p, state)) return 0;
  return state.qty.filter((q) => q != null).length / p.items.length;
}

export function verify(p: MarketPuzzle, sol: MarketSolution, state: MarketState): VerifyResult {
  if (!wellFormed(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const prog = progress(p, sol, state);
  if (state.qty.some((q) => q == null)) return { ok: false, progress: prog, reason: "basket not full" };
  const qty = state.qty as number[];
  if (basketCost(p, qty) !== spendOf(p)) return { ok: false, progress: prog, reason: "wrong change" };
  const broken = p.clues.findIndex((c) => clueHolds(c, qty) !== true);
  if (broken >= 0) return { ok: false, progress: prog, reason: `rule ${broken + 1} broken` };
  if (qty.some((q, i) => q !== sol.qty[i])) return { ok: false, progress: prog, reason: "not the answer" };
  return { ok: true, progress: 1 };
}

/* ---------------- Hint ---------------- */

/** One deduction with a reason: fixes a wrong count first, then fills the most clearly settled item. */
export function hint(p: MarketPuzzle, sol: MarketSolution, state: MarketState | undefined): Hint | null {
  if (state === undefined) state = { qty: p.items.map(() => null) };
  if (!wellFormed(p, state)) return null;
  const qty = state.qty;
  const key = (i: number) => p.items[i].key;
  const wrong = qty.findIndex((q, i) => q != null && q !== sol.qty[i]);
  if (wrong >= 0) return { target: { item: wrong, clear: true }, text: t.hint.wrong(key(wrong), qty[wrong]!) };
  const empty = qty.map((q, i) => (q == null ? i : -1)).filter((i) => i >= 0);
  if (!empty.length) return null;
  const known = (i: number) => qty[i] != null;
  const say = (i: number, text: string): Hint => ({ target: { item: i, value: sol.qty[i] }, text });

  // 1. the last item: the money left settles it
  if (empty.length === 1) {
    const i = empty[0];
    const left = spendOf(p) - basketCost(p, qty);
    return say(i, t.hint.last(key(i), left, sol.qty[i], p.items[i].deal && sol.qty[i] >= 4));
  }
  for (const i of empty) {
    // 2. a rule tying it to a filled item
    for (const c of p.clues) {
      if (c.k === "same" && (c.i === i || c.j === i)) {
        const o = c.i === i ? c.j : c.i;
        if (known(o)) return say(i, t.hint.same(key(i), key(o), sol.qty[i]));
      }
      if (c.k === "twice" && c.i === i && known(c.j)) return say(i, t.hint.twice(key(i), key(c.j), sol.qty[i]));
      if (c.k === "twice" && c.j === i && known(c.i)) return say(i, t.hint.half(key(i), key(c.i), sol.qty[i]));
    }
  }
  for (const i of empty) {
    // 3. a floor on the list meets the ceiling the money allows
    const floor = Math.max(MIN_Q, ...p.clues.filter((c) => c.k === "min" && c.i === i).map((c) => (c as { n: number }).n));
    if (floor === sol.qty[i] && floor > MIN_Q) {
      let others = 0;
      for (let j = 0; j < p.items.length; j++) {
        if (j === i) continue;
        const lo = qty[j] ?? Math.max(MIN_Q, ...p.clues.filter((c) => c.k === "min" && c.i === j).map((c) => (c as { n: number }).n));
        others += costOf(p.items[j], lo);
      }
      let most = 0;
      for (let v = MIN_Q; v <= MAX_Q; v++) if (others + costOf(p.items[i], v) <= spendOf(p)) most = v;
      if (most === floor) return say(i, t.hint.afford(key(i), floor));
    }
  }
  // 4. the money: the item with the fewest counts the exact change allows, and the rules pick one of them
  let best = empty[0],
    bestSet: number[] = [];
  for (const i of empty) {
    const seen = new Set<number>();
    for (const s of solve({ ...p, clues: [] }, 5000, qty)) seen.add(s[i]);
    if (!bestSet.length || seen.size < bestSet.length) {
      bestSet = [...seen].sort((a, b) => a - b);
      best = i;
    }
  }
  if (bestSet.length === 1) return say(best, t.hint.money1(key(best), sol.qty[best], p.change));
  if (bestSet.length <= 4) return say(best, t.hint.money(key(best), bestSet, sol.qty[best]));
  return say(best, t.hint.only(key(best), sol.qty[best], p.change));
}

const logic: GameLogic<MarketPuzzle, MarketSolution, MarketState> = {
  id: "market",
  generate,
  countSolutions,
  verify,
  progress,
  hint,
};
export default logic;
