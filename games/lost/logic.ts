/**
 * Lost: escape the daily maze. Fog lifts as you move. Score is time (the shell's clock).
 * The server verifies the move log: replayed from the start, every move must go through an open
 * passage and the walk must end on the exit. Generator: recursive backtracker (a perfect maze, so the
 * shortest route is unique) with the exit placed on the cell farthest from the start.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { BIT, DIR_NAME, opposite, step } from "@/games/_shared/grid";

export interface LostPuzzle {
  rows: number;
  cols: number;
  /** open passages per cell as a bit mask (N 1, E 2, S 4, W 8), row-major */
  cells: number[];
  start: number;
  exit: number;
}
/** the shortest route as directions (0 N, 1 E, 2 S, 3 W) */
export type LostSolution = number[];
/** the player's move log; bumps into walls are not logged */
export interface LostState {
  moves: number[];
}

export const SIZE_FOR: Record<Difficulty, number> = { easy: 8, medium: 10, hard: 12, expert: 14, mega: 16 };
/** a generous cap on log length so a replay stays cheap */
export const maxMoves = (p: LostPuzzle) => p.rows * p.cols * 8;

export const canMove = (p: LostPuzzle, at: number, d: number) => (p.cells[at] & BIT[d]) !== 0 && step(p.rows, p.cols, at, d) >= 0;

/** Replays moves from the start. `at` is where the walk ends; `bad` is the index of the first illegal move. */
export function replay(p: LostPuzzle, moves: number[]): { at: number; bad: number; path: number[]; reachedAt: number } {
  let at = p.start;
  const path = [at];
  let reachedAt = at === p.exit ? 0 : -1;
  for (let k = 0; k < moves.length; k++) {
    const d = moves[k];
    if (!canMove(p, at, d)) return { at, bad: k, path, reachedAt };
    at = step(p.rows, p.cols, at, d);
    path.push(at);
    if (at === p.exit && reachedAt < 0) reachedAt = k + 1;
  }
  return { at, bad: -1, path, reachedAt };
}

/** BFS distance of every cell from `from` through open passages. */
export function distances(p: LostPuzzle, from: number): number[] {
  const dist = new Array<number>(p.rows * p.cols).fill(-1);
  dist[from] = 0;
  const q = [from];
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    for (let d = 0; d < 4; d++) {
      if (!canMove(p, i, d)) continue;
      const j = step(p.rows, p.cols, i, d);
      if (dist[j] < 0) {
        dist[j] = dist[i] + 1;
        q.push(j);
      }
    }
  }
  return dist;
}

/** Cells the player can see from `at`: two steps through open passages, and straight down open corridors. */
export function visibleFrom(p: LostPuzzle, at: number, reach = 2, corridor = 4): number[] {
  const out = new Set<number>([at]);
  let ring = [at];
  for (let s = 0; s < reach; s++) {
    const next: number[] = [];
    for (const i of ring) {
      for (let d = 0; d < 4; d++) {
        if (!canMove(p, i, d)) continue;
        const j = step(p.rows, p.cols, i, d);
        if (!out.has(j)) {
          out.add(j);
          next.push(j);
        }
      }
    }
    ring = next;
  }
  for (let d = 0; d < 4; d++) {
    let i = at;
    for (let s = 0; s < corridor && canMove(p, i, d); s++) {
      i = step(p.rows, p.cols, i, d);
      out.add(i);
    }
  }
  return [...out];
}

/* ---------------- Grader ---------------- */

/** Difficulty 0..100: size, how long the route is, and how many dead ends tempt you. */
export function grade(p: LostPuzzle, sol: LostSolution): number {
  const N = p.rows * p.cols;
  const deadEnds = p.cells.filter((m) => [1, 2, 4, 8].includes(m)).length / N;
  const g = (p.rows - 8) * 6 + (sol.length / N) * 60 + deadEnds * 40;
  return Math.max(0, Math.min(100, Math.round(g)));
}

/* ---------------- Generator ---------------- */

export function generate(rng: Rng, difficulty: Difficulty): Generated<LostPuzzle, LostSolution> {
  const n = SIZE_FOR[difficulty];
  const N = n * n;
  const cells = new Array<number>(N).fill(0);
  const seen = new Array<boolean>(N).fill(false);
  // start in a corner quadrant so the walk crosses the maze
  const start = rng.pick([0, n - 1, N - n, N - 1]);
  const stack = [start];
  seen[start] = true;
  while (stack.length) {
    const i = stack[stack.length - 1];
    const dirs = rng.shuffle([0, 1, 2, 3]).filter((d) => {
      const j = step(n, n, i, d);
      return j >= 0 && !seen[j];
    });
    if (!dirs.length) {
      stack.pop();
      continue;
    }
    const d = dirs[0];
    const j = step(n, n, i, d);
    cells[i] |= BIT[d];
    cells[j] |= BIT[opposite(d)];
    seen[j] = true;
    stack.push(j);
  }
  const base = { rows: n, cols: n, cells, start, exit: start };
  const dist = distances(base, start);
  let exit = 0;
  dist.forEach((v, i) => v > dist[exit] && (exit = i));
  const puzzle: LostPuzzle = { ...base, exit };
  const solution = route(puzzle, start);
  return { puzzle, solution, grade: grade(puzzle, solution) };
}

/** Shortest route from `from` to the exit as directions. */
export function route(p: LostPuzzle, from: number): number[] {
  const toExit = distances(p, p.exit);
  const out: number[] = [];
  let at = from;
  while (at !== p.exit && toExit[at] > 0) {
    for (let d = 0; d < 4; d++) {
      if (!canMove(p, at, d)) continue;
      const j = step(p.rows, p.cols, at, d);
      if (toExit[j] === toExit[at] - 1) {
        out.push(d);
        at = j;
        break;
      }
    }
  }
  return out;
}

/* ---------------- Verification ---------------- */

function isState(p: LostPuzzle, state: unknown): state is LostState {
  if (!state || typeof state !== "object") return false;
  const m = (state as LostState).moves;
  return Array.isArray(m) && m.length <= maxMoves(p) && m.every((d) => d === 0 || d === 1 || d === 2 || d === 3);
}

/** How much closer to the exit the player stands, 0 at the start, 1 on the exit. */
function progressOf(p: LostPuzzle, _sol: LostSolution, state: LostState): number {
  if (!isState(p, state)) return 0;
  const r = replay(p, state.moves);
  const toExit = distances(p, p.exit);
  return Math.max(0, Math.min(1, 1 - toExit[r.at] / toExit[p.start]));
}

export function verify(p: LostPuzzle, sol: LostSolution, state: LostState): VerifyResult {
  if (!isState(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const r = replay(p, state.moves);
  const progress = progressOf(p, sol, state);
  if (r.bad >= 0) return { ok: false, progress, reason: "walked through a wall" };
  if (r.at !== p.exit) return { ok: false, progress, reason: "did not reach the exit" };
  if (r.reachedAt !== state.moves.length) return { ok: false, progress, reason: "moves after the exit" };
  return { ok: true, progress: 1 };
}

/** The next step along the shortest route from where the player stands. Target is the next cell. */
export function hint(p: LostPuzzle, _sol: LostSolution, state: LostState): Hint | null {
  const at = isState(p, state) ? replay(p, state.moves).at : p.start;
  if (at === p.exit) return null;
  const d = route(p, at)[0];
  return { target: step(p.rows, p.cols, at, d), text: `Head ${DIR_NAME[d]}.` };
}

const logic: GameLogic<LostPuzzle, LostSolution, LostState> = {
  id: "lost",
  generate,
  verify,
  progress: progressOf,
  hint,
};
export default logic;
