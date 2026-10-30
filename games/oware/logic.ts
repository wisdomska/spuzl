/**
 * Oware Daily and Free play (Abapa rules, engine.ts): "Capture the most in one sow."
 * A mid-game position with you to move; exactly one pit captures the most. Harder days add more
 * capturing options, laps (12+ seeds) and grand-slam traps that capture nothing.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { legalPits, sow } from "./engine";

export interface OwarePuzzle {
  /** 12 pits, 0..5 yours (left to right), 6..11 the rival's */
  pits: number[];
  /** seeds already captured [you, rival] */
  scores: [number, number];
}
export interface OwareSolution {
  pit: number;
  gain: number;
}
export interface OwareState {
  pit: number | null;
}

interface Spec {
  seeds: [number, number];
  minGain: number;
  minOptions: number;
  trap: boolean;
  lap: boolean;
}
const SPEC: Record<Difficulty, Spec> = {
  easy: { seeds: [12, 18], minGain: 2, minOptions: 1, trap: false, lap: false },
  medium: { seeds: [16, 24], minGain: 4, minOptions: 2, trap: false, lap: false },
  hard: { seeds: [16, 26], minGain: 4, minOptions: 2, trap: true, lap: false },
  expert: { seeds: [20, 30], minGain: 5, minOptions: 3, trap: true, lap: false },
  mega: { seeds: [30, 40], minGain: 6, minOptions: 2, trap: false, lap: true },
};

export function gains(p: OwarePuzzle): { pit: number; gain: number; grandSlam: boolean }[] {
  return legalPits(p.pits, 0).map((pit) => {
    const r = sow(p.pits, pit);
    return { pit, gain: r.gain, grandSlam: r.grandSlam };
  });
}

/** Pits that tie for the biggest capture. A valid puzzle has exactly one. */
export function countSolutions(p: OwarePuzzle, limit = 2): number {
  const g = gains(p);
  const best = Math.max(0, ...g.map((x) => x.gain));
  return best === 0 ? 0 : Math.min(limit, g.filter((x) => x.gain === best).length);
}

export function grade(p: OwarePuzzle): number {
  const g = gains(p);
  const best = Math.max(...g.map((x) => x.gain));
  const options = g.filter((x) => x.gain > 0).length;
  const traps = g.filter((x) => x.grandSlam).length;
  const laps = p.pits.slice(0, 6).filter((n) => n >= 12).length;
  const seeds = p.pits.reduce((a, b) => a + b, 0);
  return Math.min(100, Math.round(best * 4 + options * 6 + traps * 10 + laps * 8 + seeds / 3));
}

function spread(rng: Rng, total: number, lap: boolean, thinRival: boolean): number[] {
  const pits = new Array(12).fill(0);
  let left = total;
  if (lap) {
    const p = rng.int(0, 5);
    pits[p] = rng.int(12, 15);
    left -= pits[p];
  }
  // Trap days keep the rival row thin (0 to 2 per pit) so a grand slam is possible.
  if (thinRival) for (let p = 6; p < 12 && left > 0; p++) {
    pits[p] = Math.min(left, rng.int(0, 2));
    left -= pits[p];
  }
  let guard = 0;
  while (left > 0 && guard++ < 10000) {
    const p = thinRival ? rng.int(0, 5) : rng.int(0, 11);
    if (pits[p] >= 9 && !(lap && pits[p] >= 12)) continue;
    pits[p]++;
    left--;
  }
  return left > 0 ? [] : pits;
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<OwarePuzzle, OwareSolution> {
  const s = SPEC[difficulty];
  for (let attempt = 0; attempt < 50000; attempt++) {
    const total = rng.int(s.seeds[0], s.seeds[1]);
    const pits = spread(rng, total, s.lap, s.trap);
    if (!pits.length) continue;
    if (pits.slice(6).reduce((a, b) => a + b, 0) === 0) continue;
    const captured = 48 - total;
    const mine = Math.max(Math.max(0, captured - 24), Math.min(24, captured, Math.round(captured / 2) + rng.int(-4, 4)));
    const puzzle: OwarePuzzle = { pits, scores: [mine, captured - mine] };
    const g = gains(puzzle);
    const best = Math.max(0, ...g.map((x) => x.gain));
    if (best < s.minGain || countSolutions(puzzle, 2) !== 1) continue;
    if (g.filter((x) => x.gain > 0).length < s.minOptions) continue;
    if (s.trap && !g.some((x) => x.grandSlam)) continue;
    if (s.lap && sow(pits, pits.findIndex((n) => n >= 12)).gain === 0) continue;
    const pit = g.find((x) => x.gain === best)!.pit;
    return { puzzle, solution: { pit, gain: best }, grade: grade(puzzle) };
  }
  throw new Error(`oware: could not generate a ${difficulty} puzzle`);
}

const wellFormed = (s: unknown): s is OwareState => !!s && typeof s === "object" && "pit" in s;

export function verify(p: OwarePuzzle, sol: OwareSolution, state: OwareState): VerifyResult {
  if (!wellFormed(state) || !Number.isInteger(state.pit)) return { ok: false, progress: 0, reason: "malformed state" };
  if (!legalPits(p.pits, 0).includes(state.pit!)) return { ok: false, progress: 0, reason: "illegal pit" };
  const gain = sow(p.pits, state.pit!).gain;
  if (gain !== sol.gain || state.pit !== sol.pit) return { ok: false, progress: 0, score: gain, reason: "not the biggest capture" };
  return { ok: true, progress: 1, score: gain };
}

export function progress(p: OwarePuzzle, sol: OwareSolution, state: OwareState): number {
  return verify(p, sol, state).ok ? 1 : 0;
}

/** Warns off a previewed grand slam, otherwise points at the answer. */
export function hint(p: OwarePuzzle, sol: OwareSolution, state: OwareState): Hint | null {
  const picked = wellFormed(state) ? state.pit : null;
  if (picked === sol.pit) return null;
  const slam = gains(p).find((x) => x.grandSlam && x.pit === picked);
  if (slam) return { target: slam.pit, text: `Pit ${slam.pit + 1} would take every seed they have. A grand slam captures nothing.` };
  return { target: sol.pit, text: `Count the seeds in pit ${sol.pit + 1}. Follow them round.` };
}

const logic: GameLogic<OwarePuzzle, OwareSolution, OwareState> = { id: "oware", generate, countSolutions, verify, progress, hint };
export default logic;
