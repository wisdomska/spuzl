/**
 * Draughts matches (English 8 × 8, see engine.ts), validated on the server. A move is the list of
 * squares the piece visits. Seat 0 starts at the bottom and moves first.
 */
import type { BoardGameRules, MatchStatus } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { applyMove, count, findMove, initialBoard, legalMoves, type Board, type DMove, type Seat } from "./engine";

export interface DraughtsMatch {
  board: Board;
  turn: Seat;
  /** plies since the last capture or crowning (80 = 40 moves each, a draw) */
  quiet: number;
  moves: number[][];
}
export type DraughtsMove = number[];

export const QUIET_LIMIT = 80;

function statusOf(s: DraughtsMatch): MatchStatus {
  if (!legalMoves(s.board, s.turn).length) return { over: true, winner: 1 - s.turn, reason: count(s.board, s.turn) ? "no legal moves" : "no pieces left" };
  if (s.quiet >= QUIET_LIMIT) return { over: true, winner: null, reason: "40 moves without a capture" };
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
  initial: () => ({ board: initialBoard(), turn: 0, quiet: 0, moves: [] }),
  turn: (s) => s.turn,
  legalMoves: (s, seat) => (seat !== s.turn || statusOf(s).over ? [] : legalMoves(s.board, s.turn).map((m) => m.path)),
  isLegal: (s, seat, move) => seat === s.turn && !statusOf(s).over && findMove(s.board, s.turn, move) !== null,
  apply(s, seat, move) {
    if (seat !== s.turn) throw new Error("not your turn");
    if (statusOf(s).over) throw new Error("game over");
    const m = findMove(s.board, s.turn, move);
    if (!m) throw new Error("illegal move");
    return { board: applyMove(s.board, m), turn: (1 - s.turn) as Seat, quiet: m.caps.length || m.crowns ? 0 : s.quiet + 1, moves: [...s.moves, m.path] };
  },
  status: statusOf,
  /** Practice bot: longest capture, then crowning, then the move that leaves the least to lose. */
  botMove(s, seat, rng: Rng) {
    const me = seat as Seat;
    const moves = legalMoves(s.board, me);
    if (!moves.length) throw new Error("no legal moves");
    let best: DMove[] = [], bestV = -Infinity;
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
