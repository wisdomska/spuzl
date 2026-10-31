import owareRules, { type OwareMatch, type OwareMove } from "@/games/oware/rules";
import { legalPits, sideSeeds, type Seat } from "@/games/oware/engine";
import type { SearchGame } from "../search";
import { makeBot } from "../types";

/** Searches on the match state itself (the rules settle the end of the game), without the move history. */
type P = OwareMatch;

/** Captured seeds count most; seeds kept on your own side are a small edge (they are yours if play stops). */
export function evaluateOware(s: OwareMatch, seat: number): number {
  const me = seat as Seat,
    them = (1 - seat) as Seat;
  return (s.scores[me] - s.scores[them]) * 10 + (sideSeeds(s.pits, me) - sideSeeds(s.pits, them));
}

export const owareSearch: SearchGame<P, number> = {
  toMove: (p) => p.turn,
  terminal(p) {
    const st = owareRules.status(p);
    return st.over ? { winner: st.winner } : null;
  },
  moves: (p) => legalPits(p.pits, p.turn),
  // the rules end the game when the mover is stuck, so terminal() has already caught it
  stuck: () => ({ winner: null }),
  play: (p, pit) => owareRules.apply(p, p.turn, pit, undefined as never),
  evaluate: evaluateOware,
};

export const owareBot = makeBot<OwareMatch, OwareMove, P, number>(owareRules, owareSearch, {
  toPos: (s) => ({ ...s, history: [] }),
  toMove: (pit) => pit,
  maxDepth: 12,
});
