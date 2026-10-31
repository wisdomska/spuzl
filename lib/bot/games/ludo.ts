import ludoRules, { type LudoMatch, type LudoMove } from "@/games/ludo/rules";
import { HOME, LAST_TRACK, absOf, applyStep, legalSteps, threatened, type Table } from "@/games/ludo/engine";
import { scoreStep } from "@/games/ludo/logic";
import type { Bot } from "../types";

/** How much of a seat's progress sits within a rival's reach (pieces 1..6 squares ahead of a rival). */
function exposure(t: Table, seat: number): number {
  const colour = t.colours[seat];
  return t.pieces[seat].reduce((sum, p) => (p >= 0 && p <= LAST_TRACK && threatened(t, seat, absOf(colour, p)) ? sum + 10 + p : sum), 0);
}

/**
 * Hard Ludo: the puzzle rubric (capture, home, safety, leaving base) plus a look at the whole table after
 * the move, so it does not leave a far-travelled piece in range to save a short one, and it prefers
 * moving the piece that is most at risk.
 */
export function ludoHardScore(t: Table, seat: number, roll: number, piece: number): number {
  const step = legalSteps(t, seat, roll).find((s) => s.piece === piece);
  if (!step) return -Infinity;
  const base = scoreStep(t, seat, step).score;
  const after = applyStep(t, seat, step);
  const risk = exposure(after, seat) - exposure(t, seat);
  const finish = step.to === HOME ? 20 : 0;
  return base - risk * 1.5 + finish;
}

export const ludoBot: Bot<LudoMatch, LudoMove> = {
  rules: ludoRules,
  choose(state, seat, level, rng) {
    const legal = ludoRules.legalMoves(state, seat);
    if (!legal.length) throw new Error("no legal moves");
    if (legal[0].kind === "roll") return legal[0];
    if (level === "easy") return rng.pick(legal);
    if (level === "medium") return ludoRules.botMove!(state, seat, rng);
    let best = legal[0],
      bestV = -Infinity;
    for (const m of legal) {
      if (m.kind !== "move") continue;
      const v = ludoHardScore(state, seat, state.roll!, m.piece) + rng.next() * 0.01;
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    return best;
  },
};
