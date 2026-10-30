/**
 * Four Up matches (live Duel and async), validated on the server. A move is a column 0..6.
 * Seat 0 drops star discs and moves first; four in a line in any direction wins; a full board draws.
 */
import type { BoardGameRules, MatchStatus } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { drop, dropRow, dropWins, emptyGrid, openCols, winner, type Grid } from "./engine";

export interface FourUpMatch {
  grid: Grid;
  moves: number[];
}
export type FourUpMove = number;

const turnOf = (s: FourUpMatch) => s.moves.length % 2;

function statusOf(s: FourUpMatch): MatchStatus {
  const w = winner(s.grid);
  if (w) return { over: true, winner: w.who - 1, reason: "four in a line" };
  if (!openCols(s.grid).length) return { over: true, winner: null, reason: "board full" };
  return { over: false, winner: null };
}

export const fourupRules: BoardGameRules<FourUpMatch, FourUpMove> = {
  id: "fourup",
  seats: { min: 2, max: 2 },
  initial: () => ({ grid: emptyGrid(), moves: [] }),
  turn: turnOf,
  legalMoves: (s, seat) => (seat !== turnOf(s) || statusOf(s).over ? [] : openCols(s.grid)),
  isLegal: (s, seat, col) => seat === turnOf(s) && !statusOf(s).over && dropRow(s.grid, col) >= 0,
  apply(s, seat, col) {
    if (seat !== turnOf(s)) throw new Error("not your turn");
    if (statusOf(s).over) throw new Error("game over");
    if (dropRow(s.grid, col) < 0) throw new Error("illegal column");
    return { grid: drop(s.grid, col, seat + 1), moves: [...s.moves, col] };
  },
  status: statusOf,
  /** Practice bot: win now, block now, never set up the rival's four, prefer the centre. */
  botMove(s, seat, rng: Rng) {
    const me = seat + 1, them = 3 - me;
    const cols = openCols(s.grid);
    if (!cols.length) throw new Error("no legal moves");
    const win = cols.find((c) => dropWins(s.grid, c, me));
    if (win !== undefined) return win;
    const block = cols.find((c) => dropWins(s.grid, c, them));
    if (block !== undefined) return block;
    const safe = cols.filter((c) => {
      const g = drop(s.grid, c, me);
      return !openCols(g).some((x) => dropWins(g, x, them));
    });
    const pool = safe.length ? safe : cols;
    const weighted = pool.flatMap((c) => Array(4 - Math.abs(3 - c)).fill(c) as number[]);
    return rng.pick(weighted);
  },
};

export default fourupRules;
