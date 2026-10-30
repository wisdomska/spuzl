/**
 * Merge: 2048 against a 3 minute clock. Spawns come from a seeded stream, so everyone with the same
 * seed gets the same sequence of spawn draws. Score = highest tile, then the sum of all tiles.
 * The server re-plays the move log with the same seed; a forged board or time cannot pass.
 */
import { createRng } from "@/lib/rng";
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

export type Dir = "U" | "D" | "L" | "R";
export const DIRS: Dir[] = ["U", "D", "L", "R"];
export const DIR_WORD: Record<Dir, string> = { U: "up", D: "down", L: "left", R: "right" };

export interface MergePuzzle {
  size: number;
  seed: string;
  /** chance a spawn is a 4 */
  four: number;
  limitMs: number;
}
/** What a simple bot reached on this seed; the server keeps it to grade and to sanity-check scores. */
export interface MergeSolution {
  botBest: number;
  botSum: number;
}
export interface MergeState {
  /** [direction, active ms since the first move] */
  moves: [Dir, number][];
}

export const LIMIT_MS = 180_000;
/** grace for clock drift and the last frame */
const GRACE_MS = 1500;
/** sum never reaches this, so tile-then-sum sorts as one number */
export const TILE_WEIGHT = 10_000_000;

export interface Step {
  /** board after the slide (before the spawn) */
  board: number[];
  /** for every source cell with a tile, where it went */
  trail: { from: number; to: number; merged: boolean }[];
  /** cells that hold a freshly merged tile */
  mergedAt: number[];
  gained: number;
  changed: boolean;
}

/** Line indexes for a direction, each ordered from the wall the tiles slide toward. */
function lines(size: number, dir: Dir): number[][] {
  const out: number[][] = [];
  for (let a = 0; a < size; a++) {
    const line: number[] = [];
    for (let b = 0; b < size; b++) {
      if (dir === "L") line.push(a * size + b);
      else if (dir === "R") line.push(a * size + (size - 1 - b));
      else if (dir === "U") line.push(b * size + a);
      else line.push((size - 1 - b) * size + a);
    }
    out.push(line);
  }
  return out;
}

/** One slide with merges (each tile merges once per move), plus a trail for animation. */
export function slide(size: number, board: number[], dir: Dir): Step {
  const next = new Array<number>(size * size).fill(0);
  const trail: Step["trail"] = [];
  const mergedAt: number[] = [];
  let gained = 0;
  for (const line of lines(size, dir)) {
    let w = 0;
    let lastMerged = true; // the tile at w-1 already merged (or there is none)
    for (const i of line) {
      const v = board[i];
      if (!v) continue;
      if (w > 0 && !lastMerged && next[line[w - 1]] === v) {
        next[line[w - 1]] = v * 2;
        gained += v * 2;
        mergedAt.push(line[w - 1]);
        trail.push({ from: i, to: line[w - 1], merged: true });
        lastMerged = true;
        continue;
      }
      next[line[w]] = v;
      trail.push({ from: i, to: line[w], merged: false });
      w++;
      lastMerged = false;
    }
  }
  const changed = next.some((v, i) => v !== board[i]);
  return { board: next, trail, mergedAt, gained, changed };
}

/** The spawn stream: two draws per spawn (cell, value). */
export function spawner(p: MergePuzzle) {
  const rng = createRng(`${p.seed}:spawn`);
  return (board: number[]): { board: number[]; at: number } => {
    const cell = rng.next(), val = rng.next();
    const empty = board.flatMap((v, i) => (v ? [] : [i]));
    if (!empty.length) return { board, at: -1 };
    const at = empty[Math.floor(cell * empty.length)];
    const out = board.slice();
    out[at] = val < p.four ? 4 : 2;
    return { board: out, at };
  };
}

export function initialBoard(p: MergePuzzle): { board: number[]; spawn: ReturnType<typeof spawner> } {
  const spawn = spawner(p);
  let board = new Array<number>(p.size * p.size).fill(0);
  board = spawn(board).board;
  board = spawn(board).board;
  return { board, spawn };
}

export const canMove = (size: number, board: number[]) => DIRS.some((d) => slide(size, board, d).changed);
export const best = (board: number[]) => Math.max(...board);
export const total = (board: number[]) => board.reduce((s, v) => s + v, 0);
export const scoreOf = (board: number[]) => best(board) * TILE_WEIGHT + total(board);

export interface Replay {
  board: number[];
  bad: number;
  reason?: string;
}

export function replay(p: MergePuzzle, moves: [Dir, number][]): Replay {
  const { board: b0, spawn } = initialBoard(p);
  let board = b0;
  let t = 0;
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k];
    if (!Array.isArray(m) || !DIRS.includes(m[0]) || !Number.isFinite(m[1])) return { board, bad: k, reason: "malformed move" };
    if (m[1] < t || m[1] > p.limitMs + GRACE_MS) return { board, bad: k, reason: "bad time" };
    t = m[1];
    const s = slide(p.size, board, m[0]);
    if (!s.changed) return { board, bad: k, reason: "move changes nothing" };
    board = spawn(s.board).board;
  }
  return { board, bad: -1 };
}

/* ---------------- Bot (hints, grading) ---------------- */

/** Board heuristic: empty cells, a big tile in a corner, smooth monotone rows. */
function evaluate(size: number, b: number[]): number {
  const empty = b.filter((v) => !v).length;
  const corner = Math.max(b[0], b[size - 1], b[size * (size - 1)], b[size * size - 1]) === best(b) ? 1 : 0;
  let mono = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c + 1 < size; c++) {
    const a = b[r * size + c], d = b[r * size + c + 1];
    mono -= Math.abs(Math.log2(a || 1) - Math.log2(d || 1));
    const x = b[c * size + r], y = b[(c + 1) * size + r];
    mono -= Math.abs(Math.log2(x || 1) - Math.log2(y || 1));
  }
  return empty * 10 + corner * 25 + mono * 1.5;
}

/** Best direction by a one-ply look-ahead with the worst-case 2 spawn. */
export function suggest(size: number, board: number[]): Dir | null {
  let pick: Dir | null = null;
  let score = -Infinity;
  for (const d of DIRS) {
    const s = slide(size, board, d);
    if (!s.changed) continue;
    let worst = Infinity;
    const empty = s.board.flatMap((v, i) => (v ? [] : [i]));
    for (const i of empty) {
      const b = s.board.slice();
      b[i] = 2;
      worst = Math.min(worst, evaluate(size, b));
    }
    const v = (empty.length ? worst : evaluate(size, s.board)) + s.gained * 0.1;
    if (v > score) {
      score = v;
      pick = d;
    }
  }
  return pick;
}

/** Runs the bot for a fixed number of moves on the seed. */
export function botRun(p: MergePuzzle, maxMoves: number): number[] {
  const { board: b0, spawn } = initialBoard(p);
  let board = b0;
  for (let k = 0; k < maxMoves; k++) {
    const d = suggest(p.size, board);
    if (!d) break;
    board = spawn(slide(p.size, board, d).board).board;
  }
  return board;
}

/* ---------------- Generator ---------------- */

interface Spec {
  size: number;
  four: number;
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { size: 4, four: 0.05 },
  medium: { size: 4, four: 0.1 },
  hard: { size: 4, four: 0.15 },
  expert: { size: 4, four: 0.2 },
  mega: { size: 5, four: 0.1 },
};

/** 0..100: more 4 spawns, a weaker bot run and the big Sunday board (more tiles to keep in order) mean harder. */
export function grade(p: MergePuzzle, sol: MergeSolution): number {
  const reach = Math.log2(Math.max(2, sol.botBest)) / 11;
  return Math.max(0, Math.min(100, Math.round(p.four * 200 + (p.size === 4 ? 30 : 52) + (1 - reach) * 40)));
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<MergePuzzle, MergeSolution> {
  const { size, four } = SPEC[difficulty];
  const seed = `${rng.int(0, 2 ** 31 - 1).toString(36)}${rng.int(0, 2 ** 31 - 1).toString(36)}`;
  const puzzle: MergePuzzle = { size, seed, four, limitMs: LIMIT_MS };
  const end = botRun(puzzle, 250);
  const solution = { botBest: best(end), botSum: total(end) };
  return { puzzle, solution, grade: grade(puzzle, solution) };
}

/* ---------------- Verification ---------------- */

const wellFormed = (s: unknown): s is MergeState =>
  !!s && typeof s === "object" && Array.isArray((s as MergeState).moves) && (s as MergeState).moves.length <= 20_000;

export function progress(p: MergePuzzle, _sol: MergeSolution, state: MergeState): number {
  if (!wellFormed(state)) return 0;
  const r = replay(p, state.moves);
  return Math.min(1, Math.log2(best(r.board)) / 11);
}

export function verify(p: MergePuzzle, sol: MergeSolution, state: MergeState): VerifyResult {
  if (!wellFormed(state)) return { ok: false, progress: 0, reason: "malformed state" };
  const r = replay(p, state.moves);
  if (r.bad >= 0) return { ok: false, progress: 0, reason: `move ${r.bad + 1}: ${r.reason}` };
  return { ok: true, progress: progress(p, sol, state), score: scoreOf(r.board) };
}

export function hint(p: MergePuzzle, _sol: MergeSolution, state: MergeState | undefined): Hint | null {
  // before the first move the shell has no state yet: hint from the empty board
  if (state === undefined) state = { moves: [] };
  if (!wellFormed(state)) return null;
  const r = replay(p, state.moves);
  if (r.bad >= 0) return null;
  const d = suggest(p.size, r.board);
  return d ? { target: d, text: `Try a swipe ${DIR_WORD[d]}.` } : null;
}

const logic: GameLogic<MergePuzzle, MergeSolution, MergeState> = {
  id: "merge",
  generate,
  verify,
  progress,
  hint,
};
export default logic;
