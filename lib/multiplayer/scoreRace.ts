/**
 * R3-08: Party score races. A score game (Quickfire, Emoji Hits, Two Truths and a Lie...) is raced like any Party
 * game, on the same seeded round, but placed by points: most points first, then the faster finish, then progress.
 * Pure, shared by the server (the authority) and its tests.
 *
 * Scores are never taken from the client. The server scores a run from the board state it holds (sent with
 * progress and the finish) and, for games judged through the guess transport, from the answer log it kept for
 * that player in this round (`match_players.race_log`), with the game's own checks: `verify` (the score) and
 * `audit` (the state must hold exactly the answers the server judged). A run that fails either scores nothing.
 */
import type { GameLogic } from "@/games/types";

export interface ScoredRun {
  /** a score stands: the state verifies (complete or not) and matches the server's answer log */
  ok: boolean;
  score: number;
  reason?: string;
}

/**
 * The game's verdict on a run. A finish is accepted when this is ok: a quiz has every question answered and judged;
 * a word or reflex game has a valid state (Seven below its target, Higher or Lower out of slips still score).
 */
export function scoreRun(
  logic: Pick<GameLogic, "verify" | "audit">,
  puzzle: unknown,
  solution: unknown,
  state: unknown,
  log: unknown[],
): ScoredRun {
  if (state === null || state === undefined) return { ok: false, score: 0, reason: "no state" };
  let v: ReturnType<GameLogic["verify"]>;
  try {
    v = logic.verify(puzzle, solution, state);
  } catch {
    return { ok: false, score: 0, reason: "malformed state" };
  }
  let problem: string | null = null;
  try {
    problem = logic.audit?.(puzzle, solution, state, Array.isArray(log) ? log : []) ?? null;
  } catch {
    problem = "audit failed";
  }
  if (problem) return { ok: false, score: 0, reason: problem };
  if (typeof v.score !== "number" || !Number.isFinite(v.score)) return { ok: false, score: 0, reason: v.reason ?? "no score" };
  return { ok: true, score: Math.max(0, Math.round(v.score)) };
}

export interface ScoreRacer {
  id: string;
  /** the server's points for this run (0 when none stands) */
  score: number;
  /** server finish time, null when they never finished */
  timeMs: number | null;
  progress: number;
  mistakes: number;
  gone?: boolean;
  passed?: boolean;
}

export interface ScorePlaced extends ScoreRacer {
  place: number;
  points: number;
}

/** Most points, then finished before not, then the faster finish, then progress; skippers and leavers last. */
export function scoreOrder<T extends ScoreRacer>(racers: T[]): T[] {
  return [...racers].sort((a, b) => {
    if (!!a.passed !== !!b.passed) return a.passed ? 1 : -1;
    if (a.score !== b.score) return b.score - a.score;
    if ((a.timeMs !== null) !== (b.timeMs !== null)) return a.timeMs !== null ? -1 : 1;
    if (a.timeMs !== null && b.timeMs !== null && a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
    if (!!a.gone !== !!b.gone) return a.gone ? 1 : -1;
    return b.progress - a.progress || a.mistakes - b.mistakes || a.id.localeCompare(b.id);
  });
}

/**
 * Party points for a score round, on the time race's scale (lib/multiplayer/race.ts `racePoints`): anyone with a
 * score or a finish gets 500 + 100 per player beaten; nothing scored gets up to 300 for progress; a skip gets 0.
 */
export function scoreRacePoints(r: ScoreRacer, place: number, n: number): number {
  if (r.passed) return 0;
  if (r.score <= 0 && r.timeMs === null) return Math.round(Math.max(0, Math.min(1, r.progress)) * 300);
  return 500 + 100 * (n - place);
}

export function placeScoreRace(racers: ScoreRacer[]): ScorePlaced[] {
  const order = scoreOrder(racers);
  return order.map((r, i) => ({ ...r, place: i + 1, points: scoreRacePoints(r, i + 1, order.length) }));
}

/**
 * A score round ends when everyone still here has finished (or skipped), or at the time limit (admin setting
 * "party.scoreRaceSeconds"). Unlike a time race there is no early close after the first finish: a fast finish is
 * not a high score.
 */
export function scoreRaceOver(
  racers: { timeMs: number | null; gone?: boolean; passed?: boolean }[],
  startedAt: number,
  now: number,
  limitMs: number,
): boolean {
  const here = racers.filter((r) => !r.gone && !r.passed);
  if (!here.length || here.every((r) => r.timeMs !== null)) return true;
  return now - startedAt >= limitMs;
}
