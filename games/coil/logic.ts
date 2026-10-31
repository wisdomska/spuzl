/**
 * Coil: trace themed words through a 6 × 5 letter grid (8 directions). The theme words tile the grid,
 * so every letter is used exactly once. Content is hand-written (content.ts); the layout is generated
 * per (entry, difficulty): easy paths run mostly straight, harder ones turn and cut diagonals.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { GuessLogic } from "@/games/_shared/guess";
import { isWord } from "@/games/_shared/words";
import { createRng, type Rng } from "@/lib/rng";
import { CONTENT } from "./content";
import {
  adjacent,
  COLS,
  MIN_LEN,
  rc,
  ROWS,
  sameCells,
  spell,
  validPath,
  type CoilCheck,
  type CoilGuess,
  type CoilPuzzle,
  type CoilSolution,
  type CoilState,
} from "./rules";

export const contentCount = CONTENT.length;

/** 0 = straight runs preferred, 1 = turns and diagonals preferred */
export const TWIST: Record<Difficulty, number> = { easy: 0, medium: 0.3, hard: 0.5, expert: 0.7, mega: 0.85 };

/* ---------------- Layout ---------------- */

const key = (a: number, b: number) => (a < b ? a * 64 + b : b * 64 + a);

/**
 * Tiles the grid with one path per word by backtracking from the first empty cell in reading order.
 * Diagonal steps may not cross another diagonal step. Returns paths (first letter first) or null.
 */
export function layout(words: string[], rows: number, cols: number, rng: Rng, twist: number, budget = 60000): number[][] | null {
  const n = rows * cols;
  const owner = new Array<number>(n).fill(-1);
  const diag = new Set<number>();
  const paths: number[][] = new Array(words.length);
  const used = new Array<boolean>(words.length).fill(false);
  let nodes = 0;

  const crosses = (a: number, b: number) => {
    const [ra, ca] = rc(a, cols);
    const [rb, cb] = rc(b, cols);
    if (ra === rb || ca === cb) return false;
    return diag.has(key(ra * cols + cb, rb * cols + ca));
  };

  const sumsOk = () => {
    // every empty region must be fillable by some subset of the remaining word lengths
    let sums = 1n;
    words.forEach((w, i) => {
      if (!used[i]) sums |= sums << BigInt(w.length);
    });
    const seen = new Array<boolean>(n).fill(false);
    for (let s = 0; s < n; s++) {
      if (owner[s] !== -1 || seen[s]) continue;
      let size = 0;
      const stack = [s];
      seen[s] = true;
      while (stack.length) {
        const i = stack.pop()!;
        size++;
        for (let j = 0; j < n; j++) {
          if (!seen[j] && owner[j] === -1 && adjacent(i, j, cols)) {
            seen[j] = true;
            stack.push(j);
          }
        }
      }
      if (((sums >> BigInt(size)) & 1n) === 0n) return false;
    }
    return true;
  };

  const ordered = (path: number[]) => {
    const last = path[path.length - 1];
    const prev = path.length > 1 ? path[path.length - 2] : -1;
    const [rl, cl] = rc(last, cols);
    const out: { j: number; s: number }[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = rl + dr,
          c = cl + dc;
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
        const j = r * cols + c;
        if (owner[j] !== -1 || path.includes(j) || crosses(last, j)) continue;
        const isDiag = dr !== 0 && dc !== 0;
        let straight = false;
        if (prev >= 0) {
          const [rp, cp] = rc(prev, cols);
          straight = rl - rp === dr && cl - cp === dc;
        }
        const bias = (1 - twist) * ((straight ? 1 : 0) + (isDiag ? -0.6 : 0.4)) + twist * ((straight ? -0.5 : 0.5) + (isDiag ? 0.6 : 0));
        out.push({ j, s: bias + rng.next() * 0.9 });
      }
    }
    return out.sort((a, b) => b.s - a.s).map((o) => o.j);
  };

  const place = (): boolean => {
    if (++nodes > budget) return false;
    const f = owner.indexOf(-1);
    if (f < 0) return used.every(Boolean);
    const tried = new Set<string>();
    const order = rng.shuffle(words.map((_, i) => i).filter((i) => !used[i]));
    for (const w of order) {
      const word = words[w];
      for (const rev of rng.chance(0.5) ? [false, true] : [true, false]) {
        const tag = `${word}:${rev}`;
        if (tried.has(tag)) continue;
        tried.add(tag);
        const grow = (path: number[]): boolean => {
          if (nodes > budget) return false;
          if (path.length === word.length) {
            const cells = rev ? path.slice().reverse() : path.slice();
            const edges: number[] = [];
            for (let k = 1; k < path.length; k++) {
              const [ra, ca] = rc(path[k - 1], cols);
              const [rb, cb] = rc(path[k], cols);
              if (ra !== rb && ca !== cb) edges.push(key(path[k - 1], path[k]));
            }
            cells.forEach((i) => (owner[i] = w));
            edges.forEach((e) => diag.add(e));
            used[w] = true;
            paths[w] = cells;
            if (sumsOk() && place()) return true;
            cells.forEach((i) => (owner[i] = -1));
            edges.forEach((e) => diag.delete(e));
            used[w] = false;
            return false;
          }
          nodes++;
          for (const j of ordered(path)) {
            // temporarily claim the diagonal so the rest of this path cannot cross itself
            const [ra, ca] = rc(path[path.length - 1], cols);
            const [rb, cb] = rc(j, cols);
            const d = ra !== rb && ca !== cb ? key(path[path.length - 1], j) : -1;
            if (d >= 0) diag.add(d);
            const ok = grow([...path, j]);
            if (d >= 0) diag.delete(d);
            if (ok) return true;
          }
          return false;
        };
        if (grow([f])) return true;
      }
    }
    return false;
  };
  return place() ? paths : null;
}

/** Every distinct cell set along which `word` can be traced in the grid (stops at `limit`). */
export function tracings(letters: string[], rows: number, cols: number, word: string, limit = 4): number[][] {
  const out: number[][] = [];
  const keys = new Set<string>();
  const n = rows * cols;
  const rec = (path: number[]) => {
    if (out.length >= limit) return;
    if (path.length === word.length) {
      const k = path
        .slice()
        .sort((a, b) => a - b)
        .join(",");
      if (!keys.has(k)) {
        keys.add(k);
        out.push(path.slice());
      }
      return;
    }
    const last = path[path.length - 1];
    for (let j = 0; j < n; j++) {
      if (letters[j] === word[path.length] && adjacent(last, j, cols) && !path.includes(j)) rec([...path, j]);
    }
  };
  for (let i = 0; i < n; i++) if (letters[i] === word[0]) rec([i]);
  return out;
}

/** Number of distinct placements of the theme words, capped: 1 means every word sits in exactly one spot. */
export function countSolutions(p: CoilPuzzle, limit = 2, words?: string[]): number {
  if (!words) return 1;
  let worst = 1;
  for (const w of words) worst = Math.max(worst, tracings(p.letters, p.rows, p.cols, w, limit).length);
  return Math.min(worst, limit);
}

/** 0..100: share of turns and diagonal steps, plus a little for word count. */
export function grade(paths: number[][], cols: number): number {
  let steps = 0,
    bends = 0;
  for (const p of paths) {
    for (let k = 1; k < p.length; k++) {
      steps++;
      const [ra, ca] = rc(p[k - 1], cols);
      const [rb, cb] = rc(p[k], cols);
      if (ra !== rb && ca !== cb) bends++;
      if (k > 1) {
        const [rp, cp] = rc(p[k - 2], cols);
        if (ra - rp !== rb - ra || ca - cp !== cb - ca) bends++;
      }
    }
  }
  return Math.max(0, Math.min(100, Math.round(10 + (bends / Math.max(1, steps)) * 60 + paths.length * 3)));
}

/* ---------------- Generation ---------------- */

export function generateAt(index: number, difficulty: Difficulty): Generated<CoilPuzzle, CoilSolution> {
  const i = ((index % contentCount) + contentCount) % contentCount;
  const entry = CONTENT[i];
  const rng = createRng(`coil:${i}:${difficulty}`);
  // Prefer a layout where every theme word can be traced in exactly one spot; otherwise keep the one with
  // the fewest ambiguous words (a second spot answers "right word, lives somewhere else").
  let fallback: { letters: string[]; paths: number[][] } | null = null;
  let fewest = Infinity;
  for (let attempt = 0; attempt < 300 && fewest > 0; attempt++) {
    const paths = layout(entry.words, ROWS, COLS, rng, TWIST[difficulty], 3000);
    if (!paths) continue;
    const letters = new Array<string>(ROWS * COLS);
    paths.forEach((p, w) => p.forEach((cell, k) => (letters[cell] = entry.words[w][k])));
    const ambiguous = entry.words.filter((w) => tracings(letters, ROWS, COLS, w, 2).length > 1).length;
    if (ambiguous < fewest) {
      fewest = ambiguous;
      fallback = { letters, paths };
    }
  }
  if (!fallback) throw new Error(`coil: could not lay out entry ${i}`);
  const puzzle: CoilPuzzle = {
    ref: { game: "coil", i, d: difficulty },
    rows: ROWS,
    cols: COLS,
    letters: fallback.letters,
    theme: entry.theme,
    count: entry.words.length,
  };
  return { puzzle, solution: { words: entry.words.slice(), paths: fallback.paths }, grade: grade(fallback.paths, COLS) };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<CoilPuzzle, CoilSolution> {
  return generateAt(rng.int(0, contentCount - 1), difficulty);
}

/* ---------------- Guesses and verification ---------------- */

/** Pure check of one traced path, for the server guess API. */
export function checkGuess(p: CoilPuzzle, s: CoilSolution, guess: CoilGuess): CoilCheck {
  if (!validPath(guess, p.rows, p.cols)) return { ok: false, reason: "path" };
  const word = spell(p.letters, guess);
  if (word.length < MIN_LEN) return { ok: false, reason: "short", word };
  const idx = s.words.findIndex((w, i) => w === word && sameCells(s.paths[i], guess));
  if (idx >= 0) return { ok: true, index: idx, word, path: s.paths[idx].slice() };
  if (s.words.includes(word)) return { ok: false, reason: "spot", word };
  return isWord(word) ? { ok: false, bonus: true, reason: "bonus", word } : { ok: false, reason: "not-word", word };
}

/**
 * Distinct bonus words in a state, each re-checked against the dictionary here (never trusted from the
 * client). Returns null when any bonus entry is malformed, not a real word, or a repeat.
 */
export function bonusWords(p: CoilPuzzle, s: CoilSolution, state: CoilState): string[] | null {
  const list = state?.bonus;
  if (list === undefined) return [];
  if (!Array.isArray(list)) return null;
  const out: string[] = [];
  for (const path of list) {
    const r = checkGuess(p, s, path as CoilGuess);
    if (!r.bonus || out.includes(r.word)) return null;
    out.push(r.word);
  }
  return out;
}

function matched(p: CoilPuzzle, s: CoilSolution, state: CoilState): Set<number> | null {
  if (!state || typeof state !== "object" || !Array.isArray(state.found)) return null;
  const got = new Set<number>();
  for (const path of state.found) {
    const r = checkGuess(p, s, path as CoilGuess);
    if (!r.ok || got.has(r.index)) return null;
    got.add(r.index);
  }
  return got;
}

export function verify(p: CoilPuzzle, s: CoilSolution, state: CoilState): VerifyResult {
  const got = matched(p, s, state);
  if (!got) return { ok: false, progress: 0, reason: "malformed or wrong path" };
  if (!bonusWords(p, s, state)) return { ok: false, progress: 0, reason: "invalid bonus word" };
  const progress = got.size / s.words.length;
  return got.size === s.words.length ? { ok: true, progress: 1 } : { ok: false, progress, reason: "incomplete" };
}

export function progress(p: CoilPuzzle, s: CoilSolution, state: CoilState): number {
  return (matched(p, s, state)?.size ?? 0) / s.words.length;
}

/** Lights up the cells of the shortest word not yet found (cells sorted, so the order stays hidden). */
export function hint(p: CoilPuzzle, s: CoilSolution, state: CoilState): Hint | null {
  const got = matched(p, s, state) ?? new Set<number>();
  const left = s.words
    .map((w, i) => i)
    .filter((i) => !got.has(i))
    .sort((a, b) => s.words[a].length - s.words[b].length);
  if (!left.length) return null;
  const cells = s.paths[left[0]].slice().sort((a, b) => a - b);
  return { target: cells, text: `The glowing letters make a ${s.words[left[0]].length} letter theme word.` };
}

const logic: GuessLogic<CoilPuzzle, CoilSolution, CoilState, CoilGuess, CoilCheck> = {
  id: "coil",
  contentCount,
  generate,
  generateAt,
  checkGuess,
  verify,
  progress,
  hint,
};
export default logic;
