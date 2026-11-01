/**
 * Dara (West Africa): the pure rules engine for full games (vs bot) and the puzzle generator.
 *
 * Board 5 rows × 6 columns, 12 stones each; seat 0 goes first.
 * - Drop phase: players take turns dropping a stone on any empty cell. A drop may not make three (or more)
 *   in a row: lines only count in the move phase.
 * - Move phase (once every stone is down): move one of your stones one step up, down, left or right to an
 *   empty cell. Making exactly three in a row (across or down, not diagonal; four or more does not count)
 *   with the moved stone captures one of the opponent's stones of your choice.
 * - You lose when you are down to two stones (you can never make three again) or, on your turn in the move
 *   phase, you have no move. A rare drop-phase jam (no legal drop) puts your remaining stones aside.
 * - 80 plies of the move phase without a capture is a draw.
 */
import type { BoardGameRules, MatchStatus } from "@/games/types";
import type { Rng } from "@/lib/rng";

export const ROWS = 5;
export const COLS = 6;
export const CELLS = ROWS * COLS;
export const STONES = 12;
export const QUIET_LIMIT = 80;

export type Seat = 0 | 1;
/** 0 empty, 1 a seat 0 stone, 2 a seat 1 stone; row-major */
export type Board = number[];

export interface DaraMatch {
  board: Board;
  /** stones still to drop */
  hand: [number, number];
  turn: Seat;
  /** move-phase plies since the last capture */
  quiet: number;
}
export type DaraMove = { kind: "drop"; to: number } | { kind: "move"; from: number; to: number; take?: number };

export const rowOf = (i: number) => Math.floor(i / COLS);
export const colOf = (i: number) => i % COLS;
const piece = (seat: number) => seat + 1;

/** Orthogonal neighbours of a cell. */
export const NEIGHBOURS: number[][] = Array.from({ length: CELLS }, (_, i) => {
  const r = rowOf(i),
    c = colOf(i);
  const out: number[] = [];
  if (r > 0) out.push(i - COLS);
  if (r < ROWS - 1) out.push(i + COLS);
  if (c > 0) out.push(i - 1);
  if (c < COLS - 1) out.push(i + 1);
  return out;
});

/** Length of the same-colour run through `i` across (h) and down (v), counting `i` as `who`. */
export function runs(board: Board, i: number, who: number): { h: number; v: number } {
  const r = rowOf(i),
    c = colOf(i);
  let h = 1,
    v = 1;
  for (let k = c - 1; k >= 0 && board[r * COLS + k] === who; k--) h++;
  for (let k = c + 1; k < COLS && board[r * COLS + k] === who; k++) h++;
  for (let k = r - 1; k >= 0 && board[k * COLS + c] === who; k--) v++;
  for (let k = r + 1; k < ROWS && board[k * COLS + c] === who; k++) v++;
  return { h, v };
}

/** The cells of the exactly-three line(s) through `i` for `who` (empty when none). */
export function threeThrough(board: Board, i: number, who: number): number[] {
  const { h, v } = runs(board, i, who);
  const out: number[] = [];
  const r = rowOf(i),
    c = colOf(i);
  if (h === 3) {
    let k = c;
    while (k > 0 && board[r * COLS + k - 1] === who) k--;
    for (let j = 0; j < 3; j++) out.push(r * COLS + k + j);
  }
  if (v === 3) {
    let k = r;
    while (k > 0 && board[(k - 1) * COLS + c] === who) k--;
    for (let j = 0; j < 3; j++) if (!out.includes((k + j) * COLS + c)) out.push((k + j) * COLS + c);
  }
  return out;
}

/** True when a stone of `who` arriving at `to` (from `from`, or dropped when from is -1) makes exactly three. */
export function makesThree(board: Board, from: number, to: number, who: number): boolean {
  const b = from >= 0 ? board.slice() : board;
  if (from >= 0) b[from] = 0;
  const { h, v } = runs(b, to, who);
  return h === 3 || v === 3;
}

/** A drop is legal on an empty cell that does not line up three or more. */
export function dropOk(board: Board, to: number, who: number): boolean {
  if (board[to]) return false;
  const { h, v } = runs(board, to, who);
  return h < 3 && v < 3;
}

export const legalDrops = (board: Board, who: number) => Array.from({ length: CELLS }, (_, i) => i).filter((i) => dropOk(board, i, who));

/** Every step (from, to) for `who`, with whether it makes three. */
export function steps(board: Board, who: number): { from: number; to: number; three: boolean }[] {
  const out: { from: number; to: number; three: boolean }[] = [];
  for (let from = 0; from < CELLS; from++) {
    if (board[from] !== who) continue;
    for (const to of NEIGHBOURS[from]) if (!board[to]) out.push({ from, to, three: makesThree(board, from, to, who) });
  }
  return out;
}

export const stonesOf = (s: DaraMatch, seat: Seat) => s.board.filter((v) => v === piece(seat)).length + s.hand[seat];
export const inDropPhase = (s: DaraMatch) => s.hand[0] + s.hand[1] > 0;

/** Hands the turn on past a player with nothing to drop, and sets aside a hand that has no legal drop. */
function settle(s: DaraMatch): DaraMatch {
  let t = s;
  for (let k = 0; k < 4 && inDropPhase(t); k++) {
    const me = t.turn,
      them = (1 - me) as Seat;
    if (!t.hand[me]) t = { ...t, turn: them };
    else if (!legalDrops(t.board, piece(me)).length) {
      const hand: [number, number] = [...t.hand];
      hand[me] = 0;
      t = { ...t, hand, turn: them };
    } else break;
  }
  return t;
}

export function statusOf(s: DaraMatch): MatchStatus {
  for (const seat of [0, 1] as Seat[]) if (stonesOf(s, seat) < 3) return { over: true, winner: 1 - seat, reason: "two stones left" };
  if (inDropPhase(s)) return { over: false, winner: null };
  if (!steps(s.board, piece(s.turn)).length) return { over: true, winner: 1 - s.turn, reason: "no moves" };
  if (s.quiet >= QUIET_LIMIT) return { over: true, winner: null, reason: "no capture in 80 moves" };
  return { over: false, winner: null };
}

/** All legal moves for the side to move; a move that makes three comes once per stone it could take. */
export function legalMovesOf(s: DaraMatch): DaraMove[] {
  if (statusOf(s).over) return [];
  const me = piece(s.turn),
    them = piece(1 - s.turn);
  if (inDropPhase(s)) return legalDrops(s.board, me).map((to) => ({ kind: "drop" as const, to }));
  const out: DaraMove[] = [];
  const targets = s.board.flatMap((v, i) => (v === them ? [i] : []));
  for (const st of steps(s.board, me)) {
    if (st.three) for (const take of targets) out.push({ kind: "move", from: st.from, to: st.to, take });
    else out.push({ kind: "move", from: st.from, to: st.to });
  }
  return out;
}

export function isLegalMove(s: DaraMatch, seat: number, m: DaraMove): boolean {
  if (!m || typeof m !== "object" || seat !== s.turn || statusOf(s).over) return false;
  const me = piece(seat),
    them = piece(1 - seat);
  const ok = (i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < CELLS;
  if (m.kind === "drop") return inDropPhase(s) && s.hand[seat] > 0 && ok(m.to) && dropOk(s.board, m.to, me);
  if (m.kind !== "move" || inDropPhase(s) || !ok(m.from) || !ok(m.to)) return false;
  if (s.board[m.from] !== me || s.board[m.to] || !NEIGHBOURS[m.from].includes(m.to)) return false;
  const three = makesThree(s.board, m.from, m.to, me);
  if (!three) return m.take === undefined;
  return ok(m.take) && s.board[m.take] === them;
}

/** Applies a legal move (throws otherwise). */
export function applyMove(s: DaraMatch, seat: number, m: DaraMove): DaraMatch {
  if (!isLegalMove(s, seat, m)) throw new Error("illegal move");
  const board = s.board.slice();
  const hand: [number, number] = [...s.hand];
  let quiet = s.quiet;
  if (m.kind === "drop") {
    board[m.to] = piece(seat);
    hand[seat]--;
  } else {
    board[m.from] = 0;
    board[m.to] = piece(seat);
    if (m.take !== undefined) {
      board[m.take] = 0;
      quiet = 0;
    } else quiet++;
  }
  return settle({ board, hand, turn: (1 - seat) as Seat, quiet });
}

export const initialMatch = (): DaraMatch => ({ board: new Array(CELLS).fill(0), hand: [STONES, STONES], turn: 0, quiet: 0 });

/** Rival cells that make three if the side `who` moves there next (its open threats). */
export function threatCells(board: Board, who: number): Set<number> {
  return new Set(steps(board, who).flatMap((st) => (st.three ? [st.to] : [])));
}

/**
 * Practice bot (the Medium level): take when it can (a stone from the rival's readiest line), otherwise the move
 * that leaves the rival no capture and itself the most threats, with a little noise; drops build pairs.
 */
function botMove(s: DaraMatch, seat: number, rng: Rng): DaraMove {
  const moves = legalMovesOf(s);
  if (!moves.length) throw new Error("no legal moves");
  const me = piece(seat),
    them = piece(1 - seat);
  let best = moves[0],
    bestV = -Infinity;
  for (const m of moves) {
    const next = applyMove(s, seat, m);
    let v = rng.next() * 3;
    if (m.kind === "move" && m.take !== undefined) {
      v += 1000;
      // the stone whose loss costs the rival most: one that would make or block a three
      const lost = s.board.slice();
      lost[m.take] = 0;
      v += (threatCells(s.board, them).size - threatCells(lost, them).size) * 50;
    }
    if (!inDropPhase(next)) {
      const theirs = steps(next.board, them).some((st) => st.three);
      if (theirs) v -= 400;
      v += threatCells(next.board, me).size * 20;
    } else v += pairs(next.board, me) * 6 - pairs(next.board, them) * 6;
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}

/** Windows of three in a row or column holding two of `who` and one empty cell. */
export function pairs(board: Board, who: number): number {
  let n = 0;
  for (const w of WINDOWS) {
    let mine = 0,
      empty = 0;
    for (const i of w) {
      if (board[i] === who) mine++;
      else if (!board[i]) empty++;
    }
    if (mine === 2 && empty === 1) n++;
  }
  return n;
}

/** Every run of three cells across or down (the lines that can capture). */
export const WINDOWS: number[][] = (() => {
  const out: number[][] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c + 2 < COLS; c++) out.push([0, 1, 2].map((k) => r * COLS + c + k));
  for (let c = 0; c < COLS; c++) for (let r = 0; r + 2 < ROWS; r++) out.push([0, 1, 2].map((k) => (r + k) * COLS + c));
  return out;
})();

export const daraRules: BoardGameRules<DaraMatch, DaraMove> = {
  id: "dara",
  seats: { min: 2, max: 2 },
  initial: initialMatch,
  turn: (s) => s.turn,
  legalMoves: (s, seat) => (seat !== s.turn ? [] : legalMovesOf(s)),
  isLegal: isLegalMove,
  apply: (s, seat, m) => applyMove(s, seat, m),
  status: statusOf,
  botMove,
};

export default daraRules;
