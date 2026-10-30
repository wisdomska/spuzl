/**
 * Rungs: five trivia clues whose answers form a one-letter word ladder. Answer them, order them, then
 * crack the top and bottom words. Answers stay on the server; the board checks each step with checkGuess.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { GuessLogic } from "@/games/_shared/guess";
import { createRng, type Rng } from "@/lib/rng";
import { CONTENT } from "./content";
import {
  changedAt,
  diffCount,
  isPermutation,
  isWordShape,
  RUNGS,
  type RungsCheck,
  type RungsGuess,
  type RungsPuzzle,
  type RungsSolution,
  type RungsState,
} from "./rules";

export const contentCount = CONTENT.length;

const DAY_WEIGHT: Record<Difficulty, number> = { easy: 10, medium: 30, hard: 45, expert: 55, mega: 65 };

/** Ladder orders of the five rungs (as word indexes 1..5), counted up to `limit`. Content keeps this at 2. */
export function countOrders(words: string[], limit = 3): number {
  const mid = words.slice(1, 6);
  let n = 0;
  const rec = (path: number[]) => {
    if (n >= limit) return;
    if (path.length === mid.length) {
      n++;
      return;
    }
    for (let i = 0; i < mid.length; i++) {
      if (path.includes(i)) continue;
      if (path.length && diffCount(mid[path[path.length - 1]], mid[i]) !== 1) continue;
      rec([...path, i]);
    }
  };
  rec([]);
  return n;
}

export function grade(words: string[], d: Difficulty): number {
  const positions = new Set<number>();
  for (let i = 1; i < words.length; i++) positions.add(changedAt(words[i - 1], words[i]));
  return Math.max(0, Math.min(100, DAY_WEIGHT[d] + positions.size * 5 + (countOrders(words) === 2 ? 0 : 10)));
}

export function generateAt(index: number, difficulty: Difficulty): Generated<RungsPuzzle, RungsSolution> {
  const i = ((index % contentCount) + contentCount) % contentCount;
  const e = CONTENT[i];
  const rng = createRng(`rungs:${i}:${difficulty}`);
  // shuffle the trivia rungs, never in ladder order or its reverse
  let display = [1, 2, 3, 4, 5];
  for (let k = 0; k < 20; k++) {
    display = rng.shuffle([1, 2, 3, 4, 5]);
    const s = display.join("");
    if (s !== "12345" && s !== "54321") break;
  }
  const puzzle: RungsPuzzle = {
    ref: { game: "rungs", i, d: difficulty },
    clues: display.map((w) => e.clues[w]),
    caps: [e.clues[0], e.clues[6]],
  };
  if (difficulty === "easy") puzzle.starts = display.map((w) => e.words[w][0]);
  return { puzzle, solution: { words: e.words.slice(), display }, grade: grade(e.words, difficulty) };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<RungsPuzzle, RungsSolution> {
  return generateAt(rng.int(0, contentCount - 1), difficulty);
}

/** 0 when `order` (display ids top to bottom) is the ladder, 1 when it is the ladder upside down, -1 otherwise. */
export function orientation(s: RungsSolution, order: number[]): -1 | 0 | 1 {
  if (!isPermutation(order, RUNGS)) return -1;
  const idx = order.map((k) => s.display[k]).join("");
  return idx === "12345" ? 0 : idx === "54321" ? 1 : -1;
}

export function checkGuess(p: RungsPuzzle, s: RungsSolution, g: RungsGuess): RungsCheck {
  if (!g || typeof g !== "object") return { ok: false };
  if (g.kind === "rung") {
    if (!Number.isInteger(g.rung) || g.rung < 0 || g.rung >= RUNGS || !isWordShape(g.word)) return { ok: false };
    return { ok: s.words[s.display[g.rung]] === g.word };
  }
  if (g.kind === "order") {
    const o = orientation(s, g.order);
    return o < 0 ? { ok: false } : { ok: true, reversed: o === 1 };
  }
  if (g.kind === "cap") {
    if ((g.cap !== 0 && g.cap !== 1) || !isWordShape(g.word)) return { ok: false };
    return { ok: s.words[g.cap === 0 ? 0 : 6] === g.word };
  }
  return { ok: false };
}

interface Tally {
  answers: number;
  order: boolean;
  caps: number;
  valid: boolean;
}

function tally(s: RungsSolution, st: RungsState): Tally {
  const t: Tally = { answers: 0, order: false, caps: 0, valid: false };
  if (
    !st ||
    typeof st !== "object" ||
    !Array.isArray(st.answers) ||
    st.answers.length !== RUNGS ||
    !Array.isArray(st.caps) ||
    st.caps.length !== 2
  )
    return t;
  t.valid = true;
  st.answers.forEach((a, k) => a === s.words[s.display[k]] && t.answers++);
  t.order = orientation(s, st.order) === 0;
  if (t.order) [0, 1].forEach((c) => st.caps[c] === s.words[c === 0 ? 0 : 6] && t.caps++);
  return t;
}

export function progress(p: RungsPuzzle, s: RungsSolution, st: RungsState): number {
  const t = tally(s, st);
  return (t.answers + (t.order ? 1 : 0) + t.caps) / 8;
}

export function verify(p: RungsPuzzle, s: RungsSolution, st: RungsState): VerifyResult {
  const t = tally(s, st);
  if (!t.valid) return { ok: false, progress: 0, reason: "malformed state" };
  const prog = (t.answers + (t.order ? 1 : 0) + t.caps) / 8;
  return prog === 1 ? { ok: true, progress: 1 } : { ok: false, progress: prog, reason: "incomplete" };
}

/** Next step's first letter, or which rungs touch once all five are answered. */
export function hint(p: RungsPuzzle, s: RungsSolution, st: RungsState): Hint | null {
  const answers = Array.isArray(st?.answers) ? st.answers : [];
  for (let k = 0; k < RUNGS; k++) {
    const w = s.words[s.display[k]];
    if (answers[k] !== w) return { target: { rung: k }, text: `Rung ${k + 1} starts with ${w[0]}.` };
  }
  if (orientation(s, st.order) < 0) {
    const order = isPermutation(st.order, RUNGS) ? st.order : [0, 1, 2, 3, 4];
    const pos = (w: number) => order.indexOf(s.display.indexOf(w));
    let w = 1;
    while (w < 5 && Math.abs(pos(w) - pos(w + 1)) === 1) w++;
    return { target: { rung: s.display.indexOf(w + 1) }, text: `${s.words[w + 1]} sits right next to ${s.words[w]}.` };
  }
  const caps = Array.isArray(st.caps) ? st.caps : ["", ""];
  for (const c of [0, 1] as const) {
    const w = s.words[c === 0 ? 0 : 6];
    if (caps[c] !== w) return { target: { cap: c }, text: `The ${c === 0 ? "top" : "bottom"} word starts with ${w[0]}.` };
  }
  return null;
}

const logic: GuessLogic<RungsPuzzle, RungsSolution, RungsState, RungsGuess, RungsCheck> = {
  id: "rungs",
  contentCount,
  generate,
  generateAt,
  checkGuess,
  verify,
  progress,
  hint,
};
export default logic;
