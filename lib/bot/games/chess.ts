import chessRules, { type ChessMatch, type ChessMove } from "@/games/chess/rules";
import {
  BISHOP,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  WHITE,
  colorOf,
  inCheck,
  insufficientMaterial,
  isCapture,
  legalMoves,
  make,
  parseFen,
  typeOf,
  uci,
  type Move,
  type Position,
} from "@/games/chess/engine";
import type { SearchGame } from "../search";
import { makeBot } from "../types";

/** Centipawn values by piece type (index = type). */
const VALUE = [0, 100, 320, 330, 500, 900, 0];

/** Distance from the centre, 0 (centre four) to 3 (corner), by square. */
const EDGE = Array.from({ length: 64 }, (_, sq) => {
  const r = sq >> 3,
    c = sq & 7;
  return Math.max(Math.abs(2 * r - 7), Math.abs(2 * c - 7)) >> 1;
});

/**
 * Material plus a few habits a club player knows: knights and bishops toward the centre, pawns forward
 * (more so in the centre files), the king tucked away while queens are on, active once they are off.
 */
export function evaluateChess(p: Position, seat: number): number {
  const me = seat === 0 ? 0 : 1;
  let queens = 0;
  for (let sq = 0; sq < 64; sq++) if (typeOf(p.b[sq]) === QUEEN) queens++;
  let s = 0;
  for (let sq = 0; sq < 64; sq++) {
    const pc = p.b[sq];
    if (!pc) continue;
    const t = typeOf(pc),
      col = colorOf(pc);
    let v = VALUE[t];
    const r = sq >> 3,
      c = sq & 7;
    const rank = col === WHITE ? 7 - r : r; // 0 = own back rank
    if (t === KNIGHT) v += 12 - EDGE[sq] * 10;
    else if (t === BISHOP) v += 8 - EDGE[sq] * 5;
    else if (t === PAWN) v += (rank - 1) * (c >= 2 && c <= 5 ? 6 : 3) + (rank >= 5 ? 20 * (rank - 4) : 0);
    else if (t === KING) v += queens ? (rank === 0 ? 10 : -15 * rank) + (c === 1 || c === 2 || c === 6 ? 15 : 0) : 10 - EDGE[sq] * 10;
    s += col === me ? v : -v;
  }
  return s;
}

/** Captures first, most valuable victim by least valuable attacker, then promotions. */
function ordered(p: Position, ms: Move[]): Move[] {
  const key = (m: Move) => {
    let k = 0;
    if (isCapture(p, m)) k += 10 * VALUE[typeOf(p.b[m.to]) || PAWN] - VALUE[typeOf(p.b[m.from])] / 10 + 1000;
    if (m.promo) k += VALUE[m.promo] + 500;
    return k;
  };
  return ms
    .map((m) => ({ m, k: key(m) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.m);
}

export const chessSearch: SearchGame<Position, Move> = {
  toMove: (p) => (p.turn === WHITE ? 0 : 1),
  terminal: (p) => (p.half >= 100 || insufficientMaterial(p.b) ? { winner: null } : null),
  moves: (p) => ordered(p, legalMoves(p)),
  stuck: (p) => (inCheck(p) ? { winner: p.turn === WHITE ? 1 : 0 } : { winner: null }),
  play: make,
  evaluate: evaluateChess,
  tactical: (p) =>
    ordered(
      p,
      legalMoves(p).filter((m) => isCapture(p, m) || m.promo === QUEEN),
    ),
};

export const chessBot = makeBot<ChessMatch, ChessMove, Position, Move>(chessRules, chessSearch, {
  toPos: (s) => parseFen(s.fen),
  toMove: (m) => uci(m),
  maxDepth: 6,
  qDepth: 4,
});
