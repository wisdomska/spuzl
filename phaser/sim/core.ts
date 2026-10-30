/** Shared contract for every Rage Ridge simulation and the replay used by verify(). */
import type { InputLog } from "@/games/types";
import { framesToMs } from "./fixed";
import { readerFor, validateLog } from "./input";

/** Event flags raised during the last step (sound, motion and HUD hooks; never read by the sim). */
export const EV = {
  JUMP: 1,
  LAND: 2,
  DEATH: 4,
  TRAP: 8,
  EXIT_RUN: 16,
  CLEAR: 32,
  FLIP: 64,
  GRAB: 128,
  RESPAWN: 256,
  FINISH: 512,
  BOUNCE: 1024,
  PLACE: 2048,
  CUT: 4096,
  PERFECT: 8192,
  CHECKPOINT: 16384,
} as const;

export interface SimCore {
  /** advance one fixed 1/60 s step with the held buttons */
  step(buttons: number): void;
  /** total frames stepped */
  frame: number;
  deaths: number;
  finished: boolean;
  /** EV flags for the last step */
  ev: number;
  /** 0..1 course progress (HUD and Duel strip) */
  progress(): number;
  /** score-based games: the points; others 0 */
  score(): number;
  /** levels (or segments) cleared */
  cleared(): number;
}

export interface ReplayResult {
  ok: boolean;
  reason?: string;
  deaths: number;
  frames: number;
  timeMs: number;
  score: number;
  cleared: number;
  progress: number;
}

/** Re-simulates a log. ok only when the run finishes exactly on the log's last frame. */
export function replay(core: SimCore, log: InputLog, maxFrames?: number): ReplayResult {
  const bad = validateLog(log, maxFrames);
  const out = (ok: boolean, reason?: string): ReplayResult => ({
    ok,
    reason,
    deaths: core.deaths,
    frames: core.frame,
    timeMs: framesToMs(core.frame),
    score: core.score(),
    cleared: core.cleared(),
    progress: core.progress(),
  });
  if (bad) return out(false, bad);
  const at = readerFor(log);
  for (let f = 0; f < log.frames; f++) {
    if (core.finished) return out(false, "input after the finish");
    core.step(at(f));
  }
  if (!core.finished) return out(false, "course not finished");
  return out(true);
}

/** Composite rank for deaths-then-time games: higher is better, deaths always dominate. */
export function deathsRankScore(deaths: number, timeMs: number): number {
  return Math.max(0, 1_000_000_000 - Math.min(deaths, 99) * 10_000_000 - Math.min(timeMs, 9_999_999));
}
