import flipRules, { type FlipMatch, type FlipMove } from "@/games/flip/rules";
import { countOf, legalSquares, place, type Grid } from "@/games/flip/engine";
import type { SearchGame } from "../search";
import { makeBot } from "../types";

interface P {
  g: Grid;
  turn: 0 | 1;
}

/** Classic square weights: corners are gold, the squares next to an empty corner give it away. */
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, 1, 1, 1, 1, -2, 10, 5, -2, 1, 0, 0, 1, -2, 5, 5, -2, 1, 0,
  0, 1, -2, 5, 10, -2, 1, 1, 1, 1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100,
];
const CORNER_NEIGHBOURS: [number, number[]][] = [
  [0, [1, 8, 9]],
  [7, [6, 14, 15]],
  [56, [48, 49, 57]],
  [63, [54, 55, 62]],
];

/** Square weights and mobility in the opening and middle game, disc count once the board fills up. */
export function evaluateFlip(g: Grid, seat: number): number {
  const me = seat + 1,
    them = 3 - me;
  let pos = 0,
    empty = 0;
  for (let sq = 0; sq < 64; sq++) {
    const v = g[sq];
    if (!v) {
      empty++;
      continue;
    }
    let w = WEIGHTS[sq];
    // once a corner is taken, its neighbours are no longer a risk
    for (const [c, ns] of CORNER_NEIGHBOURS) if (g[c] && ns.includes(sq)) w = 5;
    pos += v === me ? w : -w;
  }
  const discs = countOf(g, me) - countOf(g, them);
  if (empty <= 10) return discs * 10 + pos;
  const mob = legalSquares(g, me).length - legalSquares(g, them).length;
  return pos + mob * 8;
}

const CORNER = new Set([0, 7, 56, 63]);

export const flipSearch: SearchGame<P, number> = {
  toMove: (p) => p.turn,
  terminal(p) {
    if (legalSquares(p.g, p.turn + 1).length) return null;
    if (legalSquares(p.g, 2 - p.turn).length) return null;
    const a = countOf(p.g, 1),
      b = countOf(p.g, 2);
    return { winner: a === b ? null : a > b ? 0 : 1 };
  },
  moves: (p) => legalSquares(p.g, p.turn + 1).sort((a, b) => Number(CORNER.has(b)) - Number(CORNER.has(a)) || WEIGHTS[b] - WEIGHTS[a]),
  stuck: () => ({ winner: null }),
  play(p, sq) {
    const g = place(p.g, sq, p.turn + 1);
    const other = (1 - p.turn) as 0 | 1;
    // the other side passes automatically when it has no move
    return { g, turn: legalSquares(g, other + 1).length ? other : p.turn };
  },
  evaluate: (p, seat) => evaluateFlip(p.g, seat),
};

export const flipBot = makeBot<FlipMatch, FlipMove, P, number>(flipRules, flipSearch, {
  toPos: (s) => ({ g: s.grid, turn: s.turn }),
  toMove: (sq) => sq,
  maxDepth: 10,
});
