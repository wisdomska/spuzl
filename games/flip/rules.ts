/**
 * Flip matches (Reversi rules, engine.ts), validated on the server. A move is a square 0..63.
 * Seat 0 plays light and moves first. A player with no legal move is passed automatically.
 */
import type { BoardGameRules, MatchStatus } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { countOf, flipsFor, initialGrid, legalSquares, place, type Grid } from "./engine";

export interface FlipMatch {
  grid: Grid;
  turn: 0 | 1;
  moves: number[];
}
export type FlipMove = number;

const CORNERS = new Set([0, 7, 56, 63]);
const X_SQUARES = new Set([9, 14, 49, 54]);

function statusOf(s: FlipMatch): MatchStatus {
  if (legalSquares(s.grid, 1).length || legalSquares(s.grid, 2).length) return { over: false, winner: null };
  const a = countOf(s.grid, 1), b = countOf(s.grid, 2);
  return { over: true, winner: a === b ? null : a > b ? 0 : 1, reason: `${a} to ${b}` };
}

export const flipRules: BoardGameRules<FlipMatch, FlipMove> = {
  id: "flip",
  seats: { min: 2, max: 2 },
  initial: () => ({ grid: initialGrid(), turn: 0, moves: [] }),
  turn: (s) => s.turn,
  legalMoves: (s, seat) => (seat !== s.turn ? [] : legalSquares(s.grid, seat + 1)),
  isLegal: (s, seat, sq) => seat === s.turn && flipsFor(s.grid, sq, seat + 1).length > 0,
  apply(s, seat, sq) {
    if (seat !== s.turn) throw new Error("not your turn");
    if (!flipsFor(s.grid, sq, seat + 1).length) throw new Error("illegal square");
    const grid = place(s.grid, sq, seat + 1);
    const other = (1 - seat) as 0 | 1;
    // pass automatically when the other side has no move
    const turn = legalSquares(grid, other + 1).length ? other : (seat as 0 | 1);
    return { grid, turn, moves: [...s.moves, sq] };
  },
  status: statusOf,
  /** Practice bot: corners first, avoids squares next to empty corners, otherwise most flips. */
  botMove(s, seat, rng: Rng) {
    const moves = legalSquares(s.grid, seat + 1);
    if (!moves.length) throw new Error("no legal moves");
    let best = moves[0], bestV = -Infinity;
    for (const m of moves) {
      const v = flipsFor(s.grid, m, seat + 1).length + (CORNERS.has(m) ? 50 : 0) - (X_SQUARES.has(m) ? 20 : 0) + rng.next();
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    return best;
  },
};

export default flipRules;
