import daraRules, { legalMovesOf, pairs, stonesOf, statusOf, steps, inDropPhase, type DaraMatch, type DaraMove } from "@/games/dara/rules";
import type { SearchGame } from "../search";
import { makeBot } from "../types";

/** Searches on the match state itself; the rules settle the end of the game. */
type P = DaraMatch;

/**
 * Stones count most. In the move phase a ready three (a step that captures) is nearly a stone, more so for the
 * side to move; mobility breaks ties. In the drop phase, open pairs (two in a window of three with the third
 * empty) are the threes of the move phase to come.
 */
export function evaluateDara(s: DaraMatch, seat: number): number {
  const me = seat + 1,
    them = 2 - seat;
  let v = (stonesOf(s, seat as 0 | 1) - stonesOf(s, (1 - seat) as 0 | 1)) * 100;
  if (inDropPhase(s)) return v + (pairs(s.board, me) - pairs(s.board, them)) * 6;
  const mine = steps(s.board, me),
    theirs = steps(s.board, them);
  const ready = (xs: { three: boolean }[]) => xs.filter((x) => x.three).length;
  const toMove = s.turn === seat;
  v += ready(mine) * (toMove ? 40 : 15) - ready(theirs) * (toMove ? 15 : 40);
  v += (mine.length - theirs.length) * 2 + (pairs(s.board, me) - pairs(s.board, them)) * 3;
  return v;
}

/** Captures first (they decide most games), then everything else. */
const ordered = (p: P) => {
  const ms = legalMovesOf(p);
  return [
    ...ms.filter((m) => m.kind === "move" && m.take !== undefined),
    ...ms.filter((m) => !(m.kind === "move" && m.take !== undefined)),
  ];
};

export const daraSearch: SearchGame<P, DaraMove> = {
  toMove: (p) => p.turn,
  terminal(p) {
    const st = statusOf(p);
    return st.over ? { winner: st.winner } : null;
  },
  moves: ordered,
  // the rules end the game when the mover is stuck, so terminal() has already caught it
  stuck: (p) => ({ winner: 1 - p.turn }),
  play: (p, m) => daraRules.apply(p, p.turn, m, undefined as never),
  evaluate: evaluateDara,
  tactical: (p) => (inDropPhase(p) ? [] : legalMovesOf(p).filter((m) => m.kind === "move" && m.take !== undefined)),
};

export const daraBot = makeBot<DaraMatch, DaraMove, P, DaraMove>(daraRules, daraSearch, {
  toPos: (s) => s,
  toMove: (m) => m,
  maxDepth: 8,
  qDepth: 2,
});
