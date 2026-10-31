/**
 * Draughts Daily and Free play (English 8 × 8 rules, see engine.ts): "Clear the board in one turn."
 * The player (seat 0, moving up) must find the one capture sequence that takes every rival piece.
 * Captures are compulsory, so the puzzle is a choice between legal capture sequences, and the
 * generator proves exactly one of them clears the board.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { EMPTY, KING0, KING1, MAN0, MAN1, count, findMove, isDark, legalMoves, samePath, type Board, type DMove } from "./engine";

export interface DraughtsPuzzle {
  board: Board;
}
export interface DraughtsSolution {
  path: number[];
}
/** The chain the player played: start square, then each landing */
export interface DraughtsState {
  path: number[];
}

export const JUMPS_FOR: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 4, expert: 5, mega: 6 };
const CHOICES_FOR: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 2, expert: 3, mega: 3 };

export const COPY = {
  rule: "Clear the board in one turn. Captures are compulsory.",
  compulsory: "Captures are compulsory. Jump a rival piece.",
  notOpen: "That jump is not open.",
  left: "Pieces left on the board. Find the full chain.",
  cleared: "Board cleared.",
} as const;

/** Capture sequences that take every rival piece. A valid puzzle has exactly one. */
export function winningMoves(p: DraughtsPuzzle): DMove[] {
  const rivals = count(p.board, 1);
  return legalMoves(p.board, 0).filter((m) => m.caps.length === rivals);
}

export function countSolutions(p: DraughtsPuzzle, limit = 2): number {
  return Math.min(limit, winningMoves(p).length);
}

export function grade(p: DraughtsPuzzle): number {
  const all = legalMoves(p.board, 0);
  const jumps = Math.max(...all.map((m) => m.caps.length));
  const starts = new Set(all.map((m) => m.path[0])).size;
  const king = all.some((m) => p.board[m.path[0]] === KING0);
  return Math.min(100, Math.round(jumps * 13 + Math.min(5, all.length - 1) * 4 + (starts - 1) * 3 + (king ? 4 : 0)));
}

/* ---------------- Generator ---------------- */

function walk(rng: Rng, jumps: number, king: boolean): Board | null {
  const b: Board = new Array(64).fill(EMPTY);
  const darks = Array.from({ length: 64 }, (_, i) => i).filter(isDark);
  const minRow = king ? 0 : 2 * jumps;
  const start = rng.pick(darks.filter((s) => s >> 3 >= minRow && s >> 3 <= 7));
  b[start] = king ? KING0 : MAN0;
  const used = new Set([start]);
  let cur = start;
  for (let i = 0; i < jumps; i++) {
    const r = cur >> 3,
      c = cur & 7;
    const dirs = (
      king
        ? [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ]
        : [
            [-1, -1],
            [-1, 1],
          ]
    ).filter(([dr, dc]) => {
      const lr = r + 2 * dr,
        lc = c + 2 * dc;
      if (lr < 0 || lr > 7 || lc < 0 || lc > 7) return false;
      const mid = (r + dr) * 8 + c + dc,
        land = lr * 8 + lc;
      if (b[mid] !== EMPTY || used.has(mid) || used.has(land) || b[land] !== EMPTY) return false;
      // a man that reaches the top row is crowned and stops, so only the last jump may land there
      if (!king && lr === 0 && i < jumps - 1) return false;
      return true;
    });
    if (!dirs.length) return null;
    const [dr, dc] = rng.pick(dirs);
    const mid = (r + dr) * 8 + c + dc;
    b[mid] = mid >> 3 === 7 ? KING1 : rng.chance(king ? 0.2 : 0.1) ? KING1 : MAN1;
    used.add(mid);
    cur = (r + 2 * dr) * 8 + c + 2 * dc;
    used.add(cur);
  }
  return b;
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<DraughtsPuzzle, DraughtsSolution> {
  const jumps = JUMPS_FOR[difficulty];
  const king = jumps > 3;
  for (let attempt = 0; attempt < 20000; attempt++) {
    const b = walk(rng, jumps, king);
    if (!b) continue;
    // Extra friendly men: decoys that may also capture, never on the crowning row.
    const decoys = rng.int(1, difficulty === "easy" ? 1 : 3);
    const free = Array.from({ length: 64 }, (_, i) => i).filter((s) => isDark(s) && b[s] === EMPTY && s >> 3 >= 1);
    rng.shuffle(free);
    for (let i = 0; i < decoys && i < free.length; i++) b[free[i]] = MAN0;
    const puzzle = { board: b };
    const all = legalMoves(b, 0);
    if (!all.length || !all[0].caps.length) continue;
    const wins = winningMoves(puzzle);
    if (wins.length !== 1 || all.length < CHOICES_FOR[difficulty]) continue;
    // keep the clearing chain long: no shorter accidental clears
    if (wins[0].caps.length !== jumps) continue;
    return { puzzle, solution: { path: wins[0].path }, grade: grade(puzzle) };
  }
  throw new Error(`draughts: could not generate a ${jumps}-jump puzzle`);
}

/* ---------------- Verification ---------------- */

const wellFormed = (s: unknown): s is DraughtsState =>
  !!s && Array.isArray((s as DraughtsState).path) && (s as DraughtsState).path.every((x) => Number.isInteger(x) && x >= 0 && x < 64);

/** Landings that match the solution from the start, as a share of the chain. Never names a square. */
export function progress(p: DraughtsPuzzle, sol: DraughtsSolution, state: DraughtsState): number {
  if (!wellFormed(state)) return 0;
  let k = 0;
  while (k < state.path.length && k < sol.path.length && state.path[k] === sol.path[k]) k++;
  return k <= 1 ? 0 : (k - 1) / (sol.path.length - 1);
}

export function verify(p: DraughtsPuzzle, sol: DraughtsSolution, state: DraughtsState): VerifyResult {
  if (!wellFormed(state)) return { ok: false, progress: 0, reason: "malformed state" };
  const pr = progress(p, sol, state);
  const m = findMove(p.board, 0, state.path);
  if (!m) return { ok: false, progress: pr, reason: "not a legal capture sequence" };
  if (m.caps.length !== count(p.board, 1)) return { ok: false, progress: pr, reason: "rival pieces left" };
  if (!samePath(m.path, sol.path)) return { ok: false, progress: pr, reason: "valid but not the scheduled solution" };
  return { ok: true, progress: 1 };
}

/**
 * Next step of the plan: which piece to start with, then each landing. A wrong partial plan gets
 * an undo hint pointing at the last good square.
 */
export function hint(p: DraughtsPuzzle, sol: DraughtsSolution, state: DraughtsState): Hint | null {
  const path = wellFormed(state) ? state.path : [];
  let k = 0;
  while (k < path.length && k < sol.path.length && path[k] === sol.path[k]) k++;
  if (k < path.length) return { target: sol.path[Math.max(0, k - 1)], text: "Undo back to here. That jump leaves pieces behind." };
  if (k >= sol.path.length) return null;
  if (k === 0) return { target: sol.path[0], text: "Start with this piece." };
  return { target: sol.path[k], text: k === sol.path.length - 1 ? "Last jump lands here." : "Jump to here next." };
}

const logic: GameLogic<DraughtsPuzzle, DraughtsSolution, DraughtsState> = {
  id: "draughts",
  generate,
  countSolutions,
  verify,
  progress,
  hint,
};
export default logic;
