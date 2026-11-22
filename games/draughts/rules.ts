/**
 * Draughts matches, validated on the server: International 10 × 10 (the default) or English 8 × 8 (engine.ts); the
 * board's size says which. A move is the list of squares the piece visits. Seat 0 starts at the bottom and moves
 * first. Matches started before the 10 × 10 board (22 Nov 2026) hold an 8 × 8 board and keep English rules.
 */
import type { BoardGameRules, MatchStatus } from "@/games/types";
import type { Rng } from "@/lib/rng";
import {
  DEFAULT_DRAUGHTS_SIZE,
  applyMove,
  count,
  findMove,
  initialBoard,
  isInternational,
  isKing,
  legalMoves,
  type Board,
  type DMove,
  type DraughtsSize,
  type Seat,
} from "./engine";

export interface DraughtsMatch {
  board: Board;
  turn: Seat;
  /**
   * Plies towards a draw: English, since the last capture or crowning (80 = 40 moves each); International, in a
   * row with only kings moving and nothing taken (50 = 25 moves each).
   */
  quiet: number;
  moves: number[][];
}
export type DraughtsMove = number[];

/** English: 40 moves each without a capture or a crowning. */
export const QUIET_LIMIT = 80;
/** International: 25 moves each with only kings moving and nothing captured. */
export const QUIET_LIMIT_INTL = 50;
/** The draw limit for this board. */
export const quietLimit = (b: Board) => (isInternational(b) ? QUIET_LIMIT_INTL : QUIET_LIMIT);

/** The draw counter after `m` (`b` is the board before it). */
export function nextQuiet(b: Board, m: DMove, quiet: number): number {
  if (m.caps.length || m.crowns) return 0;
  // International counts only king moves: a man moving resets it.
  if (isInternational(b) && !isKing(b[m.path[0]])) return 0;
  return quiet + 1;
}

/** A fresh match on a board of `n` (10 International by default, 8 English). */
export const newDraughts = (n: DraughtsSize = DEFAULT_DRAUGHTS_SIZE): DraughtsMatch => ({
  board: initialBoard(n),
  turn: 0,
  quiet: 0,
  moves: [],
});

function statusOf(s: DraughtsMatch): MatchStatus {
  if (!legalMoves(s.board, s.turn).length)
    return { over: true, winner: 1 - s.turn, reason: count(s.board, s.turn) ? "no legal moves" : "no pieces left" };
  if (s.quiet >= quietLimit(s.board))
    return {
      over: true,
      winner: null,
      reason: isInternational(s.board) ? "25 moves with only kings and no capture" : "40 moves without a capture",
    };
  return { over: false, winner: null };
}

function score(b: Board, seat: Seat) {
  let v = 0;
  b.forEach((p) => {
    if (!p) return;
    const mine = (p >= 3 ? 1 : 0) === seat;
    const val = p === 2 || p === 4 ? 3 : 1;
    v += mine ? val : -val;
  });
  return v;
}

export const draughtsRules: BoardGameRules<DraughtsMatch, DraughtsMove> = {
  id: "draughts",
  seats: { min: 2, max: 2 },
  initial: () => newDraughts(),
  turn: (s) => s.turn,
  legalMoves: (s, seat) => (seat !== s.turn || statusOf(s).over ? [] : legalMoves(s.board, s.turn).map((m) => m.path)),
  isLegal: (s, seat, move) => seat === s.turn && !statusOf(s).over && findMove(s.board, s.turn, move) !== null,
  apply(s, seat, move) {
    if (seat !== s.turn) throw new Error("not your turn");
    if (statusOf(s).over) throw new Error("game over");
    const m = findMove(s.board, s.turn, move);
    if (!m) throw new Error("illegal move");
    return {
      board: applyMove(s.board, m),
      turn: (1 - s.turn) as Seat,
      quiet: nextQuiet(s.board, m, s.quiet),
      moves: [...s.moves, m.path],
    };
  },
  status: statusOf,
  /** Practice bot: longest capture, then crowning, then the move that leaves the least to lose. */
  botMove(s, seat, rng: Rng) {
    const me = seat as Seat;
    const moves = legalMoves(s.board, me);
    if (!moves.length) throw new Error("no legal moves");
    let best: DMove[] = [],
      bestV = -Infinity;
    for (const m of moves) {
      const b = applyMove(s.board, m);
      const replies = legalMoves(b, (1 - me) as Seat);
      let worst = Infinity;
      for (const r of replies) worst = Math.min(worst, score(applyMove(b, r), me));
      if (!replies.length) worst = 100;
      const v = worst + (m.crowns ? 0.5 : 0) + rng.next() * 0.3;
      if (v > bestV) {
        bestV = v;
        best = [m];
      }
    }
    return best[0].path;
  },
};

export default draughtsRules;
