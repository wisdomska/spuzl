import fourupRules, { type FourUpMatch, type FourUpMove } from "@/games/fourup/rules";
import { COLS, ROWS, dropRow, lineThrough, type Grid } from "@/games/fourup/engine";
import type { SearchGame } from "../search";
import { makeBot } from "../types";

interface P {
  g: Grid;
  turn: number;
  /** cell of the last disc, -1 at the start */
  last: number;
}

const ORDER = [3, 2, 4, 1, 5, 0, 6];

/** Every run of four cells on the board (69 of them). */
const WINDOWS: number[][] = (() => {
  const out: number[][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ]) {
        const w: number[] = [];
        for (let k = 0; k < 4; k++) {
          const rr = r + dr * k,
            cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
          w.push(rr * COLS + cc);
        }
        if (w.length === 4) out.push(w);
      }
  return out;
})();
const LINE = [0, 1, 6, 40];

/** Open windows: each counts by how full it is for one side and empty of the other; the centre column helps. */
export function evaluateFourUp(g: Grid, seat: number): number {
  const me = seat + 1;
  let s = 0;
  for (const w of WINDOWS) {
    let mine = 0,
      theirs = 0;
    for (const i of w) {
      if (g[i] === me) mine++;
      else if (g[i]) theirs++;
    }
    if (mine && !theirs) s += LINE[mine];
    else if (theirs && !mine) s -= LINE[theirs];
  }
  for (let r = 0; r < ROWS; r++) {
    const v = g[r * COLS + 3];
    if (v) s += v === me ? 3 : -3;
  }
  return s;
}

export const fourupSearch: SearchGame<P, number> = {
  toMove: (p) => p.turn,
  terminal(p) {
    if (p.last >= 0 && lineThrough(p.g, p.last)) return { winner: p.g[p.last] - 1 };
    for (let c = 0; c < COLS; c++) if (!p.g[c]) return null;
    return { winner: null };
  },
  moves: (p) => ORDER.filter((c) => !p.g[c]),
  stuck: () => ({ winner: null }),
  play(p, c) {
    const r = dropRow(p.g, c);
    const g = p.g.slice();
    g[r * COLS + c] = p.turn + 1;
    return { g, turn: 1 - p.turn, last: r * COLS + c };
  },
  evaluate: (p, seat) => evaluateFourUp(p.g, seat),
};

export const fourupBot = makeBot<FourUpMatch, FourUpMove, P, number>(fourupRules, fourupSearch, {
  toPos: (s) => ({ g: s.grid, turn: s.moves.length % 2, last: -1 }),
  toMove: (c) => c,
  maxDepth: 9,
});
