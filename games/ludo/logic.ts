/**
 * Ludo Daily and Free play: a decision puzzle. "You rolled a N. Pick the best move."
 * Every legal move is scored by a published rubric (capture, reach home, reach safety, escape a
 * threat, leave base, do not walk into range, progress). The generator only keeps positions where
 * the best move beats the runner-up by a clear margin, so there is exactly one answer.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { HOME, LAST_TRACK, SAFE, absOf, applyStep, coloursFor, legalSteps, threatened, type Step, type Table } from "./engine";

export interface LudoPuzzle {
  table: Table;
  roll: number;
  names: string[];
}
export interface LudoSolution {
  piece: number;
}
export interface LudoState {
  piece: number | null;
}

export const MARGIN = 15;

export type Reason = "capture" | "home" | "safe" | "escape" | "out" | "exposed" | "progress";
export const REASON_COPY: Record<Reason, string> = {
  capture: "sends a rival back to base",
  home: "gets a piece home",
  safe: "lands on a safe square",
  escape: "runs a piece out of danger",
  out: "brings a new piece out",
  exposed: "walks into a rival's range",
  progress: "just moves forward",
};

export interface Scored {
  step: Step;
  score: number;
  reasons: Reason[];
}

/** The rubric. Shown to players in the help sheet so the answer is never arbitrary. */
export function scoreStep(t: Table, seat: number, step: Step): Scored {
  const reasons: Reason[] = [];
  let s = step.to / 10;
  const colour = t.colours[seat];
  if (step.captures.length) {
    s += 100 * step.captures.length + Math.max(...step.captures.map(([cs, j]) => t.pieces[cs][j])) / 2;
    reasons.push("capture");
  }
  if (step.to === HOME) {
    s += 80;
    reasons.push("home");
  }
  if (step.from < 0) {
    s += 35;
    reasons.push("out");
  }
  const after = applyStep(t, seat, step);
  const absTo = absOf(colour, step.to);
  const wasThreatened = threatened(t, seat, absOf(colour, step.from));
  const nowThreatened = threatened(after, seat, absTo);
  if ((absTo >= 0 && SAFE.has(absTo)) || (step.to > LAST_TRACK && step.to < HOME)) {
    s += 40;
    reasons.push("safe");
  }
  if (wasThreatened && !nowThreatened) {
    s += 60;
    reasons.push("escape");
  }
  if (nowThreatened) {
    s -= 60;
    reasons.push("exposed");
  }
  if (!reasons.length) reasons.push("progress");
  return { step, score: Math.round(s * 10) / 10, reasons };
}

export function ranked(p: LudoPuzzle): Scored[] {
  return legalSteps(p.table, 0, p.roll)
    .map((st) => scoreStep(p.table, 0, st))
    .sort((a, b) => b.score - a.score);
}

export function countSolutions(p: LudoPuzzle, limit = 2): number {
  const r = ranked(p);
  if (!r.length) return 0;
  return Math.min(limit, r.filter((x) => r[0].score - x.score < MARGIN).length);
}

export function grade(p: LudoPuzzle): number {
  const r = ranked(p);
  const gap = r.length > 1 ? r[0].score - r[1].score : 100;
  const rivals = p.table.pieces
    .slice(1)
    .flat()
    .filter((x) => x >= 0 && x < HOME).length;
  return Math.min(100, Math.round(r.length * 9 + Math.max(0, 60 - gap) / 2 + rivals * 2 + p.table.colours.length * 3));
}

interface Spec {
  seats: number;
  options: number;
  out: [number, number];
}
const SPEC: Record<Difficulty, Spec> = {
  easy: { seats: 2, options: 2, out: [2, 3] },
  medium: { seats: 3, options: 3, out: [2, 4] },
  hard: { seats: 4, options: 3, out: [3, 4] },
  expert: { seats: 4, options: 4, out: [3, 4] },
  mega: { seats: 4, options: 4, out: [4, 4] },
};

const NAMES = ["You", "Kofi", "Efua", "Yaw", "Ama", "Zainab", "Chidi", "Tunde"];

function randomTable(rng: Rng, seats: number, out: [number, number]): Table {
  const colours = coloursFor(seats);
  const pieces = colours.map(() => {
    const n = rng.int(out[0], out[1]);
    return [0, 1, 2, 3].map((i) => (i < n ? (rng.chance(0.1) ? rng.int(51, 55) : rng.int(0, LAST_TRACK)) : -1));
  });
  return { colours, pieces };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<LudoPuzzle, LudoSolution> {
  const s = SPEC[difficulty];
  for (let attempt = 0; attempt < 50000; attempt++) {
    const table = randomTable(rng, s.seats, s.out);
    const roll = rng.int(1, 6);
    // two pieces of one colour on one square read badly at 22 px; keep the board clean
    const cells = table.pieces.flatMap((ps, k) => ps.filter((q) => q >= 0 && q <= LAST_TRACK).map((q) => absOf(table.colours[k], q)));
    if (new Set(cells).size !== cells.length) continue;
    const names = [NAMES[0], ...rng.shuffle(NAMES.slice(1)).slice(0, s.seats - 1)];
    const puzzle: LudoPuzzle = { table, roll, names };
    const r = ranked(puzzle);
    if (r.length < s.options || countSolutions(puzzle) !== 1) continue;
    // distinct pieces only (two pieces in base share the same move)
    if (new Set(r.map((x) => `${x.step.from}`)).size !== r.length) continue;
    return { puzzle, solution: { piece: r[0].step.piece }, grade: grade(puzzle) };
  }
  throw new Error(`ludo: could not generate a ${difficulty} puzzle`);
}

const wellFormed = (s: unknown): s is LudoState => !!s && typeof s === "object" && "piece" in s;

export function verify(p: LudoPuzzle, sol: LudoSolution, state: LudoState): VerifyResult {
  if (!wellFormed(state) || !Number.isInteger(state.piece)) return { ok: false, progress: 0, reason: "malformed state" };
  if (!legalSteps(p.table, 0, p.roll).some((s) => s.piece === state.piece)) return { ok: false, progress: 0, reason: "piece cannot move" };
  if (state.piece !== sol.piece) return { ok: false, progress: 0, reason: "not the best move" };
  return { ok: true, progress: 1 };
}

export const progress = (p: LudoPuzzle, sol: LudoSolution, state: LudoState) => (verify(p, sol, state).ok ? 1 : 0);

/** Why the best move wins, in the rubric's words. */
export function explain(sc: Scored) {
  const good = sc.reasons.filter((r) => r !== "progress" && r !== "exposed");
  return good.length ? `This move ${good.map((r) => REASON_COPY[r]).join(" and ")}.` : "This move keeps every piece out of range.";
}

export function hint(p: LudoPuzzle, sol: LudoSolution, state: LudoState): Hint | null {
  if (wellFormed(state) && state.piece === sol.piece) return null;
  const best = ranked(p)[0];
  const first = best.reasons.find((r) => r !== "progress" && r !== "exposed");
  const text =
    first === "capture"
      ? "A capture is on. Capture beats running."
      : first === "escape"
        ? "One of your pieces is in danger."
        : first === "home"
          ? "One piece can get home exactly."
          : first === "safe"
            ? "Look for a star or a start square."
            : "Pick the move that keeps you out of range.";
  return { target: sol.piece, text };
}

const logic: GameLogic<LudoPuzzle, LudoSolution, LudoState> = { id: "ludo", generate, countSolutions, verify, progress, hint };
export default logic;
