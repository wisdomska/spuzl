/**
 * Higher or Lower: a chain of 11 arithmetic cards ("7 × 8", "15% of 80", "3/4 of 60"). The first card is
 * shown with its value; for each of the next 10 the player calls Higher or Lower than the card before it.
 * A wrong call is a slip and the run carries on; the third slip ends it (a failed attempt).
 * Score = right calls (time breaks ties). Neighbouring cards never tie, so every call has one answer.
 * The cards are public (it is a mental arithmetic game); the server replays the call log against the
 * sequence regenerated from the seed.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { hilo as t } from "@/lib/copy/hilo";

export type Card =
  | { k: "n"; a: number }
  | { k: "add"; a: number; b: number }
  | { k: "sub"; a: number; b: number }
  | { k: "mul"; a: number; b: number }
  | { k: "div"; a: number; b: number }
  /** a% of b */
  | { k: "pct"; a: number; b: number }
  | { k: "sq"; a: number }
  /** a/b of c */
  | { k: "frac"; a: number; b: number; c: number };
export type CardKind = Card["k"];

export interface HiloPuzzle {
  /** cards[0] is the opening card; the player calls cards[1..CALLS] */
  cards: Card[];
}
export interface HiloSolution {
  values: number[];
}
export type Call = "hi" | "lo";
export interface HiloState {
  calls: Call[];
}

/** Calls per run (10 cards to call after the opening card). */
export const CALLS = 10;
/** The third slip ends the run. */
export const MAX_SLIPS = 3;

/* ---------------- Cards ---------------- */

export function valueOf(c: Card): number {
  switch (c.k) {
    case "n":
      return c.a;
    case "add":
      return c.a + c.b;
    case "sub":
      return c.a - c.b;
    case "mul":
      return c.a * c.b;
    case "div":
      return c.a / c.b;
    case "pct":
      return (c.a * c.b) / 100;
    case "sq":
      return c.a * c.a;
    case "frac":
      return (c.a * c.c) / c.b;
  }
}

/** The card face, in maths notation. */
export function show(c: Card): string {
  switch (c.k) {
    case "n":
      return String(c.a);
    case "add":
      return `${c.a} + ${c.b}`;
    case "sub":
      return `${c.a} − ${c.b}`;
    case "mul":
      return `${c.a} × ${c.b}`;
    case "div":
      return `${c.a} ÷ ${c.b}`;
    case "pct":
      return `${c.a}% of ${c.b}`;
    case "sq":
      return `${c.a}²`;
    case "frac":
      return `${c.a}/${c.b} of ${c.c}`;
  }
}

/** One-sentence working for a card (used by the hint). */
export function reason(c: Card): string {
  switch (c.k) {
    case "n":
      return t.reason.plain(c.a);
    case "add": {
      const tens = c.b - (c.b % 10);
      return t.reason.add(c.a, tens, c.a + tens, c.b % 10);
    }
    case "sub": {
      const tens = c.b - (c.b % 10);
      return t.reason.sub(c.a, tens, c.a - tens, c.b % 10);
    }
    case "mul":
      return t.reason.mul(c.a, c.b);
    case "div":
      return t.reason.div(c.a, c.b, valueOf(c));
    case "pct":
      return t.reason.pct(c.b, c.b / 10);
    case "sq":
      return t.reason.sq(c.a);
    case "frac":
      return t.reason.frac(c.b, c.c, c.c / c.b);
  }
}

/* ---------------- Generator ---------------- */

interface Spec {
  kinds: CardKind[];
  /** smallest and largest gap between neighbouring cards */
  gap: [number, number];
  /** value range */
  range: [number, number];
  /** times-table ceiling */
  table: number;
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { kinds: ["n", "add", "mul", "mul"], gap: [5, 30], range: [8, 100], table: 10 },
  medium: { kinds: ["add", "sub", "mul", "mul", "pct"], gap: [3, 20], range: [10, 120], table: 12 },
  hard: { kinds: ["add", "sub", "mul", "div", "pct", "sq", "frac"], gap: [2, 12], range: [10, 150], table: 12 },
  expert: { kinds: ["sub", "mul", "div", "pct", "sq", "frac"], gap: [1, 8], range: [12, 160], table: 12 },
  mega: { kinds: ["sub", "mul", "div", "pct", "sq", "frac"], gap: [1, 5], range: [12, 160], table: 13 },
};

const PCTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75];
const FRACS: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [1, 5],
  [2, 5],
  [3, 5],
  [4, 5],
];

function randomCard(rng: Rng, kind: CardKind, spec: Spec): Card {
  const [lo, hi] = spec.range;
  switch (kind) {
    case "n":
      return { k: "n", a: rng.int(lo, hi) };
    case "add": {
      const a = rng.int(6, Math.floor(hi * 0.6));
      return { k: "add", a, b: rng.int(4, Math.max(5, hi - a)) };
    }
    case "sub": {
      const a = rng.int(lo + 10, hi + 20);
      return { k: "sub", a, b: rng.int(4, a - lo) };
    }
    case "mul":
      return { k: "mul", a: rng.int(2, spec.table), b: rng.int(2, spec.table) };
    case "div": {
      const b = rng.int(2, spec.table),
        v = rng.int(Math.max(2, Math.ceil(lo / 4)), spec.table + 3);
      return { k: "div", a: b * v, b };
    }
    case "pct": {
      // b a multiple of 20, so 10% and 5% are whole and every listed percent gives a whole number
      const a = rng.pick(PCTS),
        b = 20 * rng.int(1, 15);
      return { k: "pct", a, b };
    }
    case "sq":
      return { k: "sq", a: rng.int(3, spec.table) };
    case "frac": {
      const [a, b] = rng.pick(FRACS);
      return { k: "frac", a, b, c: b * rng.int(3, 40) };
    }
  }
}

const same = (x: Card, y: Card) => show(x) === show(y);

export function generate(rng: Rng, difficulty: Difficulty): Generated<HiloPuzzle, HiloSolution> {
  const spec = SPEC[difficulty];
  const [lo, hi] = spec.range;
  const fits = (v: number) => Number.isInteger(v) && v >= lo && v <= hi;
  const pick = (ok: (c: Card, v: number) => boolean): Card | null => {
    for (let i = 0; i < 400; i++) {
      const c = randomCard(rng, rng.pick(spec.kinds), spec);
      const v = valueOf(c);
      if (fits(v) && ok(c, v)) return c;
    }
    return null;
  };
  for (let attempt = 0; attempt < 50; attempt++) {
    const first = pick(() => true);
    if (!first) continue;
    const cards: Card[] = [first];
    let run = 0,
      lastDir = 0;
    while (cards.length <= CALLS) {
      const prev = cards[cards.length - 1],
        pv = valueOf(prev);
      // aim up or down at random, but never more than three calls the same way in a row
      let dir = rng.chance(0.5) ? 1 : -1;
      if (run >= 3) dir = -lastDir;
      // near an edge of the range, head back in
      if (pv - spec.gap[0] < lo) dir = 1;
      if (pv + spec.gap[0] > hi) dir = -1;
      const next = pick((c, v) => {
        const d = (v - pv) * dir;
        return d >= spec.gap[0] && d <= spec.gap[1] && !same(c, prev) && c.k !== prev.k;
      });
      if (!next) break;
      run = dir === lastDir ? run + 1 : 1;
      lastDir = dir;
      cards.push(next);
    }
    if (cards.length !== CALLS + 1) continue;
    const values = cards.map(valueOf);
    return { puzzle: { cards }, solution: { values }, grade: grade({ cards }) };
  }
  throw new Error(`hilo: could not generate a ${difficulty} run`);
}

/** 0..100: closer neighbours and harder card kinds score higher. */
export function grade(p: HiloPuzzle): number {
  const values = p.cards.map(valueOf);
  const WEIGHT: Record<CardKind, number> = { n: 0, add: 1, sub: 2, mul: 1, div: 2, pct: 3, sq: 2, frac: 3 };
  let gaps = 0,
    kinds = 0;
  for (let i = 1; i < values.length; i++) {
    gaps += Math.min(20, Math.abs(values[i] - values[i - 1]));
    kinds += WEIGHT[p.cards[i].k];
  }
  const closeness = 1 - gaps / (20 * CALLS);
  return Math.max(0, Math.min(100, Math.round(closeness * 60 + (kinds / (3 * CALLS)) * 40)));
}

/* ---------------- Replay + verification ---------------- */

export const answer = (values: number[], i: number): Call => (values[i + 1] > values[i] ? "hi" : "lo");

export interface Replay {
  right: number;
  slips: number;
  /** per call: was it right */
  results: boolean[];
  over: boolean;
  failed: boolean;
  error: string | null;
}

const wellFormed = (s: unknown): s is HiloState =>
  !!s &&
  typeof s === "object" &&
  Array.isArray((s as HiloState).calls) &&
  (s as HiloState).calls.length <= CALLS &&
  (s as HiloState).calls.every((c) => c === "hi" || c === "lo");

/** Replays the call log against the card values. A call after the run ended is an error. */
export function replay(values: number[], calls: Call[]): Replay {
  const results: boolean[] = [];
  let right = 0,
    slips = 0;
  for (let i = 0; i < calls.length; i++) {
    if (slips >= MAX_SLIPS) return { right, slips, results, over: true, failed: true, error: `call ${i + 1} after the run ended` };
    const ok = calls[i] === answer(values, i);
    results.push(ok);
    if (ok) right++;
    else slips++;
  }
  const failed = slips >= MAX_SLIPS;
  return { right, slips, results, over: failed || calls.length >= CALLS, failed, error: null };
}

export function progress(_p: HiloPuzzle, _sol: HiloSolution, state: HiloState): number {
  if (!wellFormed(state)) return 0;
  return state.calls.length / CALLS;
}

export function verify(p: HiloPuzzle, sol: HiloSolution, state: HiloState): VerifyResult {
  if (!wellFormed(state)) return { ok: false, progress: 0, reason: "malformed state" };
  if (sol.values.length !== CALLS + 1 || p.cards.length !== CALLS + 1) return { ok: false, progress: 0, reason: "bad puzzle" };
  const r = replay(sol.values, state.calls);
  const prog = state.calls.length / CALLS;
  if (r.error) return { ok: false, progress: prog, reason: r.error };
  if (r.failed) return { ok: false, progress: prog, score: r.right, reason: "out of slips" };
  if (state.calls.length < CALLS) return { ok: false, progress: prog, reason: "run not finished" };
  return { ok: true, progress: 1, score: r.right };
}

/** The value of the card in play, with its working. */
export function hint(p: HiloPuzzle, sol: HiloSolution, state: HiloState | undefined): Hint | null {
  // before the first call the shell has no state yet
  if (state === undefined) state = { calls: [] };
  if (!wellFormed(state)) return null;
  const r = replay(sol.values, state.calls);
  if (r.over || r.error) return null;
  const i = state.calls.length + 1;
  const c = p.cards[i];
  return { target: { card: i, value: sol.values[i] }, text: t.hintCard(show(c), sol.values[i], reason(c), sol.values[i - 1]) };
}

const logic: GameLogic<HiloPuzzle, HiloSolution, HiloState> = {
  id: "hilo",
  generate,
  verify,
  progress,
  hint,
};
export default logic;
