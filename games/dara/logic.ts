/**
 * Dara puzzles (Board Bay, GameShell): move-phase positions built and proved with the rules engine (rules.ts).
 * You play the light stones (seat 0) and move first.
 * - easy "capture": exactly one step makes three; take any of their stones.
 * - medium "block": exactly one step makes three, and they are one step from a three themselves: take a
 *   stone that leaves them no three next move.
 * - hard, expert, mega "three2": no three this move, but exactly one step sets up a three they cannot stop
 *   (every reply leaves you a three). Their reply is their longest defence, the same on client and server.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { dara as t } from "@/lib/copy/dara";
import { CELLS, COLS, NEIGHBOURS, ROWS, colOf, makesThree, rowOf, runs, steps, type Board } from "./rules";

export type Goal = "capture" | "block" | "three2";
export interface DaraPuzzle {
  /** 0 empty, 1 yours, 2 theirs; 5 rows × 6 columns, row-major */
  board: Board;
  goal: Goal;
}
export interface DaraSolution {
  /** the one first step */
  from: number;
  to: number;
  /** "block": the stones that may be taken; otherwise empty (any of theirs) */
  takes: number[];
}
export interface PuzzleMove {
  from: number;
  to: number;
  take?: number;
}
export interface DaraState {
  moves: PuzzleMove[];
}

export const GOAL_FOR: Record<Difficulty, Goal> = { easy: "capture", medium: "block", hard: "three2", expert: "three2", mega: "three2" };
const STONES_FOR: Record<Difficulty, [number, number]> = { easy: [5, 7], medium: [6, 8], hard: [5, 7], expert: [7, 9], mega: [8, 10] };

const ME = 1,
  THEM = 2;
const threes = (b: Board, who: number) => steps(b, who).filter((s) => s.three);
const step = (b: Board, from: number, to: number) => {
  const n = b.slice();
  n[to] = n[from];
  n[from] = 0;
  return n;
};

/** After your step (their turn): every reply they have leaves you a three, and none of theirs makes one. */
export function forced(b: Board): boolean {
  const replies = steps(b, THEM);
  if (!replies.length || replies.some((r) => r.three)) return false;
  return replies.every((r) => threes(step(b, r.from, r.to), ME).length > 0);
}

/** Their reply after a forcing step: the one that leaves you the fewest threes (first in board order on a tie). */
export function defence(b: Board): { from: number; to: number } | null {
  let best: { from: number; to: number } | null = null,
    bestN = Infinity;
  for (const r of steps(b, THEM)) {
    const n = threes(step(b, r.from, r.to), ME).length;
    if (n < bestN) {
      bestN = n;
      best = { from: r.from, to: r.to };
    }
  }
  return best;
}

/** Their stones you may take after a three in a "block" puzzle: ones that leave them no three next move. */
export function safeTakes(after: Board): number[] {
  return after.flatMap((v, i) => {
    if (v !== THEM) return [];
    const b = after.slice();
    b[i] = 0;
    return threes(b, THEM).length ? [] : [i];
  });
}

/** First steps that meet the puzzle's goal. A valid puzzle has exactly one. */
export function firstSteps(p: DaraPuzzle): { from: number; to: number }[] {
  const mine = steps(p.board, ME);
  if (p.goal === "three2") {
    if (mine.some((s) => s.three)) return [];
    return mine.filter((s) => forced(step(p.board, s.from, s.to))).map(({ from, to }) => ({ from, to }));
  }
  const good = mine.filter((s) => s.three);
  if (p.goal === "block")
    return good.filter((s) => safeTakes(step(p.board, s.from, s.to)).length > 0).map(({ from, to }) => ({ from, to }));
  return good.map(({ from, to }) => ({ from, to }));
}

export function countSolutions(p: DaraPuzzle, limit = 2): number {
  return Math.min(limit, firstSteps(p).length);
}

export interface DaraReplay {
  board: Board;
  /** their replies so far */
  replies: { from: number; to: number }[];
  /** your moves that kept to the plan */
  good: number;
  won: boolean;
  /** index of the first move that went wrong, -1 if none */
  wrongAt: number;
}

/** Plays your moves (and their replies) from the puzzle position. */
export function replay(p: DaraPuzzle, moves: readonly PuzzleMove[]): DaraReplay {
  let b = p.board.slice();
  const replies: { from: number; to: number }[] = [];
  let good = 0;
  const out = (won: boolean, wrongAt: number): DaraReplay => ({ board: b, replies, good, won, wrongAt });
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k];
    if (!m || b[m.from] !== ME || b[m.to] !== 0 || !NEIGHBOURS[m.from]?.includes(m.to)) return out(false, k);
    if (makesThree(b, m.from, m.to, ME)) {
      const after = step(b, m.from, m.to);
      if (m.take === undefined || after[m.take] !== THEM) return out(false, k);
      if (p.goal === "block" && !safeTakes(after).includes(m.take)) return out(false, k);
      b = after;
      b[m.take] = 0;
      good++;
      return out(true, -1);
    }
    if (p.goal !== "three2" || k > 0) return out(false, k);
    const after = step(b, m.from, m.to);
    if (!forced(after)) return out(false, k);
    b = after;
    good++;
    const r = defence(b)!;
    b = step(b, r.from, r.to);
    replies.push(r);
  }
  return out(false, -1);
}

const movesNeeded = (p: DaraPuzzle) => (p.goal === "three2" ? 2 : 1);

export function grade(p: DaraPuzzle): number {
  const stones = p.board.filter(Boolean).length;
  const base = { capture: 5, block: 25, three2: 50 }[p.goal];
  const options = steps(p.board, ME).length;
  return Math.min(100, Math.round(base + stones * 1.5 + options / 2));
}

/** Random stones for both sides with no line of three or more anywhere. */
function scatter(rng: Rng, mine: number, theirs: number): Board | null {
  const b = new Array(CELLS).fill(0);
  const cells = rng.shuffle(Array.from({ length: CELLS }, (_, i) => i));
  let k = 0;
  for (const [who, n] of [
    [ME, mine],
    [THEM, theirs],
  ]) {
    for (let placed = 0; placed < n;) {
      if (k >= cells.length) return null;
      const i = cells[k++];
      const { h, v } = runs(b, i, who);
      if (h >= 3 || v >= 3) continue;
      b[i] = who;
      placed++;
    }
  }
  return b;
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<DaraPuzzle, DaraSolution> {
  const goal = GOAL_FOR[difficulty];
  const [lo, hi] = STONES_FOR[difficulty];
  for (let attempt = 0; attempt < 200000; attempt++) {
    const mine = rng.int(lo, hi),
      theirs = rng.int(Math.max(3, lo - 1), hi);
    const board = scatter(rng, mine, theirs);
    if (!board) continue;
    // Both sides must be able to move; "block" needs them one step from a three, the others a quiet rival.
    if (!steps(board, ME).length || !steps(board, THEM).length) continue;
    const theirThrees = threes(board, THEM).length;
    if (goal === "block" ? theirThrees === 0 : theirThrees > 0) continue;
    const p: DaraPuzzle = { board, goal };
    const firsts = firstSteps(p);
    if (firsts.length !== 1) continue;
    const { from, to } = firsts[0];
    let takes: number[] = [];
    if (goal === "block") {
      takes = safeTakes(step(board, from, to));
      // the take must matter: some of their stones are the wrong one
      if (takes.length >= theirs) continue;
    }
    return { puzzle: p, solution: { from, to, takes }, grade: grade(p) };
  }
  throw new Error(`dara: could not generate a ${difficulty} puzzle`);
}

const wellFormed = (s: unknown): s is DaraState =>
  !!s &&
  Array.isArray((s as DaraState).moves) &&
  (s as DaraState).moves.length <= 4 &&
  (s as DaraState).moves.every(
    (m) =>
      !!m &&
      Number.isInteger(m.from) &&
      Number.isInteger(m.to) &&
      m.from >= 0 &&
      m.from < CELLS &&
      m.to >= 0 &&
      m.to < CELLS &&
      (m.take === undefined || (Number.isInteger(m.take) && m.take >= 0 && m.take < CELLS)),
  );

export function verify(p: DaraPuzzle, sol: DaraSolution, state: DaraState): VerifyResult {
  if (!wellFormed(state)) return { ok: false, progress: 0, reason: "malformed state" };
  const first = state.moves[0];
  if (!first || first.from !== sol.from || first.to !== sol.to) return { ok: false, progress: 0, reason: "wrong first move" };
  const r = replay(p, state.moves);
  const progress = r.won ? 1 : r.good / movesNeeded(p);
  if (r.wrongAt >= 0) return { ok: false, progress, reason: "move breaks the plan" };
  if (!r.won) return { ok: false, progress, reason: "incomplete" };
  return { ok: true, progress: 1 };
}

export function progress(p: DaraPuzzle, sol: DaraSolution, state: DaraState): number {
  if (!wellFormed(state)) return 0;
  const r = replay(p, state.moves);
  return r.won ? 1 : r.wrongAt >= 0 ? 0 : r.good / movesNeeded(p);
}

/** "row 2, column 3" for a cell. */
export const cellName = (i: number) => t.cell(rowOf(i) + 1, colOf(i) + 1);
/** Direction of a one-step move. */
export const dirName = (from: number, to: number) =>
  to === from - COLS ? t.dir.up : to === from + COLS ? t.dir.down : to === from - 1 ? t.dir.left : t.dir.right;

export function hint(p: DaraPuzzle, sol: DaraSolution, state: DaraState): Hint | null {
  const moves = wellFormed(state) ? state.moves : [];
  const r = replay(p, moves);
  if (r.won) return null;
  if (r.wrongAt >= 0) return { target: null, text: t.hintUndo };
  if (r.good === 0) {
    const text =
      p.goal === "three2"
        ? t.hintSetUp(cellName(sol.from), dirName(sol.from, sol.to))
        : p.goal === "block"
          ? t.hintBlock(cellName(sol.from), dirName(sol.from, sol.to))
          : t.hintCapture(cellName(sol.from), dirName(sol.from, sol.to));
    return { target: sol.from, text };
  }
  const finish = threes(r.board, ME)[0];
  return finish ? { target: finish.from, text: t.hintFinish(cellName(finish.from), dirName(finish.from, finish.to)) } : null;
}

export { ROWS, COLS };

const logic: GameLogic<DaraPuzzle, DaraSolution, DaraState> = { id: "dara", generate, countSolutions, verify, progress, hint };
export default logic;
