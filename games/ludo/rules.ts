/**
 * Ludo Party matches, 2 to 4 seats (engine.ts rules), validated on the server. Every colour carries
 * a shape. A turn is a roll (the server rolls with its rng) and then, if any piece can move, a move.
 */
import type { BoardGameRules, MatchStatus } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { HOME, applyStep, coloursFor, legalSteps, type Table } from "./engine";
import { scoreStep } from "./logic";

export type LudoMove = { kind: "roll" } | { kind: "move"; piece: number };

export interface LudoMatch extends Table {
  turn: number;
  /** current roll waiting for a move, or null before rolling */
  roll: number | null;
  /** sixes rolled in a row this turn */
  sixes: number;
  /** last rolls, newest last, for the die animation and the log */
  log: { seat: number; roll: number; piece: number | null }[];
}

export const SHAPES = ["circle", "square", "diamond", "drop"] as const;

const finished = (s: LudoMatch, seat: number) => s.pieces[seat].every((p) => p === HOME);

function statusOf(s: LudoMatch): MatchStatus {
  const w = s.pieces.findIndex((_, seat) => finished(s, seat));
  return w >= 0 ? { over: true, winner: w, reason: "all four home" } : { over: false, winner: null };
}

const nextSeat = (s: LudoMatch) => (s.turn + 1) % s.colours.length;

function legal(s: LudoMatch, seat: number): LudoMove[] {
  if (seat !== s.turn || statusOf(s).over) return [];
  if (s.roll === null) return [{ kind: "roll" }];
  return legalSteps(s, seat, s.roll).map((st) => ({ kind: "move" as const, piece: st.piece }));
}

const same = (a: LudoMove, b: LudoMove) => a.kind === b.kind && (a.kind === "roll" || a.piece === (b as { piece: number }).piece);

export const ludoRules: BoardGameRules<LudoMatch, LudoMove> = {
  id: "ludo",
  seats: { min: 2, max: 4 },
  initial(seats) {
    if (seats < 2 || seats > 4) throw new Error("ludo seats 2 to 4");
    const colours = coloursFor(seats);
    return { colours, pieces: colours.map(() => [-1, -1, -1, -1]), turn: 0, roll: null, sixes: 0, log: [] };
  },
  turn: (s) => s.turn,
  legalMoves: legal,
  isLegal: (s, seat, move) => !!move && legal(s, seat).some((m) => same(m, move)),
  apply(s, seat, move, rng) {
    if (!legal(s, seat).some((m) => !!move && same(m, move))) throw new Error("illegal move");
    if (move.kind === "roll") {
      const roll = rng.int(1, 6);
      const sixes = roll === 6 ? s.sixes + 1 : 0;
      const log = [...s.log, { seat, roll, piece: null }];
      // third six in a row, or nothing can move: the turn passes
      if (sixes === 3 || !legalSteps(s, seat, roll).length) return { ...s, roll: null, sixes: 0, turn: nextSeat(s), log };
      return { ...s, roll, sixes, log };
    }
    const step = legalSteps(s, seat, s.roll!).find((st) => st.piece === move.piece)!;
    const t = applyStep(s, seat, step);
    const again = s.roll === 6 || step.captures.length > 0 || step.to === HOME;
    const log = s.log.slice();
    log[log.length - 1] = { ...log[log.length - 1], piece: move.piece };
    const base = { ...s, ...t, roll: null, log };
    if (finished(base, seat)) return { ...base, sixes: 0 };
    return again ? base : { ...base, sixes: 0, turn: nextSeat(s) };
  },
  status: statusOf,
  /** Practice bot: rolls, then plays the move the puzzle rubric scores highest. */
  botMove(s, seat, rng: Rng) {
    const moves = legal(s, seat);
    if (!moves.length) throw new Error("no legal moves");
    if (moves[0].kind === "roll") return moves[0];
    const steps = legalSteps(s, seat, s.roll!).map((st) => scoreStep(s, seat, st));
    steps.sort((a, b) => b.score - a.score + (rng.next() - 0.5) * 0.01);
    return { kind: "move", piece: steps[0].step.piece };
  },
};

export default ludoRules;
