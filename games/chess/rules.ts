/**
 * Chess matches (live Duel and async), validated on the server. Seat 0 plays white, seat 1 black.
 * Moves are UCI strings ("e2e4", "e7e8q"). Ends on checkmate, stalemate, insufficient material,
 * the fifty-move rule or threefold repetition. Resignation, draw offers and clocks belong to the
 * match layer, not to the rules.
 */
import type { BoardGameRules, MatchStatus } from "@/games/types";
import type { Rng } from "@/lib/rng";
import {
  BLACK,
  WHITE,
  PIECE_VALUE,
  START_FEN,
  attacked,
  fromUci,
  inCheck,
  insufficientMaterial,
  isCapture,
  legalMoves,
  make,
  material,
  parseFen,
  positionKey,
  san,
  toFen,
  typeOf,
  uci,
  type Color,
  type Move,
  type Position,
} from "./engine";

export interface ChessMatch {
  fen: string;
  /** repetition keys of every position reached, oldest first */
  keys: string[];
  /** move list in SAN for the strip under the board */
  sans: string[];
}
export type ChessMove = string;

export function initialMatch(fen = START_FEN): ChessMatch {
  const p = parseFen(fen);
  return { fen: toFen(p), keys: [positionKey(p)], sans: [] };
}

function statusOf(s: ChessMatch, p: Position): MatchStatus {
  const moves = legalMoves(p);
  if (!moves.length) {
    if (inCheck(p)) return { over: true, winner: p.turn === WHITE ? 1 : 0, reason: "checkmate" };
    return { over: true, winner: null, reason: "stalemate" };
  }
  if (insufficientMaterial(p.b)) return { over: true, winner: null, reason: "insufficient material" };
  if (p.half >= 100) return { over: true, winner: null, reason: "fifty-move rule" };
  const last = s.keys[s.keys.length - 1];
  if (s.keys.filter((k) => k === last).length >= 3) return { over: true, winner: null, reason: "threefold repetition" };
  return { over: false, winner: null };
}

/** Bot evaluation from `me`'s side: material, a little centre, and safety of what hangs. */
function evaluate(p: Position, me: Color): number {
  let s = material(p.b, me) - material(p.b, (1 - me) as Color);
  for (let sq = 0; sq < 64; sq++) {
    const pc = p.b[sq];
    if (!pc || typeOf(pc) === 6) continue;
    const owner = (pc >> 3) as Color;
    const enemy = (1 - owner) as Color;
    if (attacked(p.b, sq, enemy) && !attacked(p.b, sq, owner)) s += (owner === me ? -1 : 1) * PIECE_VALUE[typeOf(pc)] * 0.5;
    const r = sq >> 3,
      c = sq & 7;
    if (r >= 2 && r <= 5 && c >= 2 && c <= 5) s += owner === me ? 0.1 : -0.1;
  }
  return s;
}

export const chessRules: BoardGameRules<ChessMatch, ChessMove> = {
  id: "chess",
  seats: { min: 2, max: 2 },
  initial: () => initialMatch(),
  turn: (s) => (parseFen(s.fen).turn === WHITE ? 0 : 1),
  legalMoves(s, seat) {
    const p = parseFen(s.fen);
    if ((p.turn === WHITE ? 0 : 1) !== seat || statusOf(s, p).over) return [];
    return legalMoves(p).map(uci);
  },
  isLegal(s, seat, move) {
    const p = parseFen(s.fen);
    if ((p.turn === WHITE ? 0 : 1) !== seat || statusOf(s, p).over) return false;
    return fromUci(p, move) !== null;
  },
  apply(s, seat, move) {
    const p = parseFen(s.fen);
    if ((p.turn === WHITE ? 0 : 1) !== seat) throw new Error("not your turn");
    if (statusOf(s, p).over) throw new Error("game over");
    const m = fromUci(p, move);
    if (!m) throw new Error(`illegal move ${String(move)}`);
    const next = make(p, m);
    return { fen: toFen(next), keys: [...s.keys, positionKey(next)], sans: [...s.sans, san(p, m)] };
  },
  status: (s) => statusOf(s, parseFen(s.fen)),
  /** Practice bot: mates in one when it can, otherwise a two-ply material search with a little noise. */
  botMove(s, seat, rng: Rng) {
    const p = parseFen(s.fen);
    const me = (seat === 0 ? WHITE : BLACK) as Color;
    const moves = legalMoves(p);
    if (!moves.length) throw new Error("no legal moves");
    let best: Move[] = [],
      bestV = -Infinity;
    for (const m of moves) {
      const a = make(p, m);
      const replies = legalMoves(a);
      if (!replies.length && inCheck(a)) return uci(m);
      let v: number;
      if (!replies.length) v = 0;
      else {
        v = Infinity;
        for (const r of replies) {
          const b = make(a, r);
          const e = inCheck(b) && !legalMoves(b).length ? -1000 : evaluate(b, me);
          if (e < v) v = e;
        }
      }
      v += isCapture(p, m) ? 0.05 : 0;
      v += rng.next() * 0.2;
      if (v > bestV + 1e-9) {
        bestV = v;
        best = [m];
      } else if (Math.abs(v - bestV) < 1e-9) best.push(m);
    }
    return uci(rng.pick(best));
  },
};

export default chessRules;
