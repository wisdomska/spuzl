/**
 * Oware matches (Abapa rules, engine.ts), validated on the server. A move is a pit index 0..11;
 * seat 0 owns 0..5 and moves first.
 */
import type { BoardGameRules, MatchStatus } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { legalPits, sideSeeds, sow, type Seat } from "./engine";

export interface OwareMatch {
  pits: number[];
  scores: [number, number];
  turn: Seat;
  /** plies since the last capture */
  quiet: number;
  over: boolean;
  history: number[];
  reason?: string;
}
export type OwareMove = number;
export const CYCLE_LIMIT = 100;

function finish(s: OwareMatch, reason: string): OwareMatch {
  return { ...s, over: true, reason };
}

/** Applies end-of-game seed collection when the side to move is stuck or the game has cycled. */
function settle(s: OwareMatch): OwareMatch {
  if (s.over) return s;
  if (s.scores[0] >= 25 || s.scores[1] >= 25 || (s.scores[0] === 24 && s.scores[1] === 24)) return finish(s, "score");
  if (!legalPits(s.pits, s.turn).length) {
    // The mover cannot play (or cannot feed): each side keeps the seeds on its own side.
    return finish({ ...s, pits: new Array(12).fill(0), scores: [s.scores[0] + sideSeeds(s.pits, 0), s.scores[1] + sideSeeds(s.pits, 1)] }, "no moves");
  }
  if (s.quiet >= CYCLE_LIMIT) return finish({ ...s, pits: new Array(12).fill(0), scores: [s.scores[0] + sideSeeds(s.pits, 0), s.scores[1] + sideSeeds(s.pits, 1)] }, "cycle");
  return s;
}

function statusOf(s: OwareMatch): MatchStatus {
  const t = settle(s);
  if (!t.over) return { over: false, winner: null };
  const [a, b] = t.scores;
  return { over: true, winner: a === b ? null : a > b ? 0 : 1, reason: t.reason ?? "score" };
}

export const owareRules: BoardGameRules<OwareMatch, OwareMove> = {
  id: "oware",
  seats: { min: 2, max: 2 },
  initial: () => ({ pits: new Array(12).fill(4), scores: [0, 0], turn: 0, quiet: 0, over: false, history: [] }),
  turn: (s) => s.turn,
  legalMoves: (s, seat) => (seat !== s.turn || statusOf(s).over ? [] : legalPits(s.pits, s.turn)),
  isLegal: (s, seat, pit) => seat === s.turn && !statusOf(s).over && legalPits(s.pits, s.turn).includes(pit),
  apply(s, seat, pit) {
    if (seat !== s.turn) throw new Error("not your turn");
    if (statusOf(s).over) throw new Error("game over");
    if (!legalPits(s.pits, s.turn).includes(pit)) throw new Error("illegal pit");
    const r = sow(s.pits, pit);
    const scores: [number, number] = [...s.scores];
    scores[seat] += r.gain;
    const next: OwareMatch = { pits: r.pits, scores, turn: (1 - seat) as Seat, quiet: r.gain ? 0 : s.quiet + 1, over: false, history: [...s.history, pit] };
    return settle(next);
  },
  status: statusOf,
  /** Practice bot: biggest capture, then the move that leaves the rival the smallest capture. */
  botMove(s, seat, rng: Rng) {
    const pits = legalPits(s.pits, seat as Seat);
    if (!pits.length) throw new Error("no legal moves");
    let best = pits[0], bestV = -Infinity;
    for (const p of pits) {
      const r = sow(s.pits, p);
      const replies = legalPits(r.pits, (1 - seat) as Seat);
      const threat = Math.max(0, ...replies.map((q) => sow(r.pits, q).gain));
      const v = r.gain * 2 - threat + rng.next() * 0.5;
      if (v > bestV) {
        bestV = v;
        best = p;
      }
    }
    return best;
  },
};

export default owareRules;
