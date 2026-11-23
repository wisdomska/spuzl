/**
 * Draughts Daily and Free play: "Clear the board in one turn." The player (seat 0, moving up) must find the one
 * capture line that takes every rival piece. The generator proves exactly one line clears the board.
 *
 * Puzzles come on the International 10 × 10 board, the default (owner, 23 Nov 2026), under its rules (see
 * engine.ts): men capture backwards too, and the line that takes the most pieces is the only legal one, so finding it
 * among the shorter lines is the puzzle. The piece that moves is always a man there (a flying king could end on any
 * of several squares, which would give one puzzle several answers). Puzzles made before, and their stored Dailies,
 * are 8 × 8 English: everything here sizes from the board, so both still play.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import {
  DEFAULT_DRAUGHTS_SIZE,
  EMPTY,
  KING0,
  KING1,
  MAN0,
  MAN1,
  captureLines,
  count,
  findMove,
  isDark,
  isInternational,
  samePath,
  type Board,
  type DMove,
  type DraughtsSize,
} from "./engine";

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

/** Jumps in the clearing line: 8 × 8, and the bigger 10 × 10 board (one more at every level). */
export const JUMPS_FOR: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 4, expert: 5, mega: 6 };
export const JUMPS_FOR_10: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 5, expert: 6, mega: 7 };
/** Capture lines on the board at least (decoys among them): 8 × 8, then 10 × 10. */
const CHOICES_FOR: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 2, expert: 3, mega: 3 };
const CHOICES_FOR_10: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 4, expert: 5, mega: 6 };

export const COPY = {
  rule: "Clear the board in one turn. Captures are compulsory.",
  /** 10 × 10: the take-the-most rule */
  ruleMost: "Clear the board in one turn. You must take the most pieces.",
  compulsory: "Captures are compulsory. Jump a rival piece.",
  notOpen: "That jump is not open.",
  left: "Pieces left on the board. Find the full chain.",
  cleared: "Board cleared.",
} as const;

/** Capture lines that take every rival piece. A valid puzzle has exactly one. */
export function winningMoves(p: DraughtsPuzzle): DMove[] {
  const rivals = count(p.board, 1);
  return captureLines(p.board, 0).filter((m) => m.caps.length === rivals);
}

export function countSolutions(p: DraughtsPuzzle, limit = 2): number {
  return Math.min(limit, winningMoves(p).length);
}

export function grade(p: DraughtsPuzzle): number {
  const all = captureLines(p.board, 0);
  if (!all.length) return 0;
  const jumps = Math.max(...all.map((m) => m.caps.length));
  const starts = new Set(all.map((m) => m.path[0])).size;
  const king = all.some((m) => p.board[m.path[0]] === KING0);
  // 10 × 10 chains run one jump longer at every level: scored on the same scale as 8 × 8
  const scaled = isInternational(p.board) ? jumps - 1 : jumps;
  return Math.min(100, Math.round(scaled * 13 + Math.min(5, all.length - 1) * 4 + (starts - 1) * 3 + (king ? 4 : 0)));
}

/* ---------------- Generator ---------------- */

const DIAG: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/**
 * A random clearing line: the mover's start, then `jumps` rival pieces each jumped onto the next square. 8 × 8 men
 * jump forward only and a man that reaches the top row is crowned and stops; 10 × 10 men jump both ways and are
 * crowned only where the line ends.
 */
function walk(rng: Rng, n: DraughtsSize, jumps: number, king: boolean): Board | null {
  const intl = n === 10;
  const b: Board = new Array(n * n).fill(EMPTY);
  const darks = Array.from({ length: n * n }, (_, i) => i).filter((s) => isDark(s, n));
  const row = (s: number) => Math.floor(s / n);
  const minRow = king || intl ? 0 : 2 * jumps;
  const start = rng.pick(darks.filter((s) => row(s) >= minRow));
  b[start] = king ? KING0 : MAN0;
  const used = new Set([start]);
  let cur = start;
  for (let i = 0; i < jumps; i++) {
    const r = row(cur),
      c = cur % n;
    const dirs = (king || intl ? DIAG : DIAG.slice(0, 2)).filter(([dr, dc]) => {
      const lr = r + 2 * dr,
        lc = c + 2 * dc;
      if (lr < 0 || lr >= n || lc < 0 || lc >= n) return false;
      const mid = (r + dr) * n + c + dc,
        land = lr * n + lc;
      if (b[mid] !== EMPTY || used.has(mid) || used.has(land) || b[land] !== EMPTY) return false;
      // English: a man that reaches the top row is crowned and stops, so only the last jump may land there
      if (!king && !intl && lr === 0 && i < jumps - 1) return false;
      return true;
    });
    if (!dirs.length) return null;
    const [dr, dc] = rng.pick(dirs);
    const mid = (r + dr) * n + c + dc;
    b[mid] = row(mid) === n - 1 ? KING1 : rng.chance(king ? 0.2 : 0.1) ? KING1 : MAN1;
    used.add(mid);
    cur = (r + 2 * dr) * n + c + 2 * dc;
    used.add(cur);
  }
  return b;
}

/** A puzzle on the given board size (Daily and Free play use the default, 10 × 10). */
export function generateSized(rng: Rng, difficulty: Difficulty, n: DraughtsSize): Generated<DraughtsPuzzle, DraughtsSolution> {
  const intl = n === 10;
  const jumps = (intl ? JUMPS_FOR_10 : JUMPS_FOR)[difficulty];
  const king = !intl && jumps > 3;
  for (let attempt = 0; attempt < 20000; attempt++) {
    const b = walk(rng, n, jumps, king);
    if (!b) continue;
    // Extra friendly men: decoys that may also capture, never on the crowning row.
    const decoys = intl ? rng.int(2, difficulty === "easy" ? 3 : 6) : rng.int(1, difficulty === "easy" ? 1 : 3);
    const free = Array.from({ length: n * n }, (_, i) => i).filter((s) => isDark(s, n) && b[s] === EMPTY && Math.floor(s / n) >= 1);
    rng.shuffle(free);
    for (let i = 0; i < decoys && i < free.length; i++) b[free[i]] = MAN0;
    const puzzle = { board: b };
    const all = captureLines(b, 0);
    if (!all.length) continue;
    const wins = winningMoves(puzzle);
    if (wins.length !== 1 || all.length < (intl ? CHOICES_FOR_10 : CHOICES_FOR)[difficulty]) continue;
    // keep the clearing line long: no shorter accidental clears
    if (wins[0].caps.length !== jumps) continue;
    // 10 × 10: the clearing line must be the legal one (it takes the most, so it is), and the only legal one
    if (intl && findMove(b, 0, wins[0].path) === null) continue;
    return { puzzle, solution: { path: wins[0].path }, grade: grade(puzzle) };
  }
  throw new Error(`draughts: could not generate a ${n} × ${n}, ${jumps}-jump puzzle`);
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<DraughtsPuzzle, DraughtsSolution> {
  return generateSized(rng, difficulty, DEFAULT_DRAUGHTS_SIZE);
}

/* ---------------- Verification ---------------- */

const wellFormed = (s: unknown): s is DraughtsState =>
  !!s && Array.isArray((s as DraughtsState).path) && (s as DraughtsState).path.every((x) => Number.isInteger(x) && x >= 0 && x < 100);

/** Landings that match the solution from the start, as a share of the chain. Never names a square. */
/** The rule line for a puzzle: 10 × 10 adds the take-the-most rule. */
export const ruleFor = (p: DraughtsPuzzle) => (isInternational(p.board) ? COPY.ruleMost : COPY.rule);

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
