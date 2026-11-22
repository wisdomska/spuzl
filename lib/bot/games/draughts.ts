import draughtsRules, { nextQuiet, quietLimit, type DraughtsMatch, type DraughtsMove } from "@/games/draughts/rules";
import { applyMove, isKing, legalMoves, seatOf, sizeOf, type Board, type DMove, type Seat } from "@/games/draughts/engine";
import type { SearchGame } from "../search";
import { makeBot } from "../types";

interface P {
  b: Board;
  turn: Seat;
  quiet: number;
}

/**
 * Men 100, kings 160 (250 on 10 × 10, where kings fly), a little for advancing men and for keeping the back row.
 */
export function evaluateDraughts(b: Board, seat: number): number {
  const n = sizeOf(b);
  const kingValue = n === 10 ? 250 : 160;
  let s = 0;
  for (let sq = 0; sq < b.length; sq++) {
    const p = b[sq];
    if (!p) continue;
    const owner = seatOf(p);
    let v: number;
    if (isKing(p)) v = kingValue;
    else {
      const r = Math.floor(sq / n);
      const advance = owner === 0 ? n - 1 - r : r;
      v = 100 + advance * 4 + (advance === 0 ? 8 : 0);
    }
    // the centre is worth a little
    const c = sq % n;
    if (c >= 2 && c <= n - 3) v += 3;
    s += owner === seat ? v : -v;
  }
  return s;
}

const caps = (m: DMove) => m.caps.length;

export const draughtsSearch: SearchGame<P, DMove> = {
  toMove: (p) => p.turn,
  terminal: (p) => (p.quiet >= quietLimit(p.b) ? { winner: null } : null),
  moves: (p) => legalMoves(p.b, p.turn).sort((a, b) => caps(b) - caps(a) || Number(b.crowns) - Number(a.crowns)),
  // no legal move loses
  stuck: (p) => ({ winner: 1 - p.turn }),
  play: (p, m) => ({ b: applyMove(p.b, m), turn: (1 - p.turn) as Seat, quiet: nextQuiet(p.b, m, p.quiet) }),
  evaluate: (p, seat) => evaluateDraughts(p.b, seat),
  // captures are compulsory, so a position with a capture on is never quiet
  tactical(p) {
    const ms = legalMoves(p.b, p.turn);
    return ms.length && ms[0].caps.length ? ms : [];
  },
};

export const draughtsBot = makeBot<DraughtsMatch, DraughtsMove, P, DMove>(draughtsRules, draughtsSearch, {
  toPos: (s) => ({ b: s.board, turn: s.turn, quiet: s.quiet }),
  toMove: (m) => m.path,
  maxDepth: 12,
  qDepth: 6,
});
