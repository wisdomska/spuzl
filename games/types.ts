/**
 * The contract every SPUZL game implements.
 *
 * games/<id>/logic.ts  — pure TypeScript, no React, no DOM. Runs on the server (verification, hints,
 *                        generation scripts) and on the client (instant feedback). Default-exports a GameLogic.
 * games/<id>/Board.tsx — client component rendered inside the shared 6-zone GameShell. Default export.
 * games/<id>/logic.test.ts — Vitest: generator determinism, solver uniqueness, verifier accepts the
 *                        solution and rejects near-misses, hints are safe, grader is monotonic enough.
 *
 * The server is authoritative: the client never receives `solution`, and rewards come only from verify().
 */
import type { Rng } from "@/lib/rng";

export type Difficulty = "easy" | "medium" | "hard" | "expert" | "mega";

/** Mon easy, Tue-Thu medium, Fri hard, Sat expert, Sun Weekly Mega (SRS 5, common rules). */
export function difficultyForDate(isoDate: string): Difficulty {
  const day = new Date(isoDate + "T00:00:00Z").getUTCDay();
  return (["mega", "easy", "medium", "medium", "medium", "hard", "expert"] as const)[day];
}

export interface Generated<P, S> {
  /** Public puzzle data. Safe to send to clients. */
  puzzle: P;
  /** Secret solution / answer key. Server only. */
  solution: S;
  /** Difficulty score from the grader, 0..100 */
  grade: number;
}

export interface VerifyResult {
  /** The submission is a valid clear */
  ok: boolean;
  /** 0..1, server-computed progress (Duel / Party strips) */
  progress: number;
  /** Score for score-based games (higher is better). Time-based games omit it. */
  score?: number;
  /** Human-readable reason when not ok (logged for anti-cheat, never shown verbatim) */
  reason?: string;
}

export interface Hint {
  /** Cell / item the hint points at, game-specific coordinates */
  target: unknown;
  /** Short copy for the feedback line, no dashes */
  text: string;
}

export interface GameLogic<P = unknown, S = unknown, St = unknown> {
  id: string;
  /** Create a puzzle from a seed. Must be deterministic for (seed, difficulty). */
  generate(rng: Rng, difficulty: Difficulty): Generated<P, S>;
  /**
   * Number of solutions, stopping at `limit`. Logic games must return exactly 1 for scheduled Dailies.
   * Games without a unique-solution requirement may omit this.
   */
  countSolutions?(puzzle: P, limit: number): number;
  /** Checks a player's final state (or move log) against the puzzle and secret solution. */
  verify(puzzle: P, solution: S, state: St): VerifyResult;
  /** Progress 0..1 for a partial state. Must never reveal the solution to the client. */
  progress(puzzle: P, solution: S, state: St): number;
  /** One safe deduction for the current state, computed server-side. */
  hint?(puzzle: P, solution: S, state: St): Hint | null;
}

/** Props the GameShell passes to every Board. */
export interface BoardProps<P = unknown, St = unknown> {
  puzzle: P;
  mode: PlayMode;
  /** Restored state (resume / offline) */
  initialState?: St;
  /** Hint target pushed by the shell after a server hint */
  hint?: Hint | null;
  /** Locked after clear, during countdowns and while paused */
  disabled?: boolean;
  api: BoardApi<St>;
}

export type PlayMode = "tutorial" | "daily" | "free" | "duel" | "race" | "archive" | "challenge";

export type FeedbackTone = "info" | "danger" | "success";

export interface BoardApi<St> {
  /** Report every move: state for autosave, local progress for the UI, feedback line content */
  onMove(state: St, info?: { correctStreak?: number; mistake?: boolean }): void;
  /** Board believes it is solved. The shell submits to the server, which decides. */
  onSolved(state: St): void;
  /** Hard fail (out of lives, Hunch out of guesses...) */
  onFailed?(state: St, reason: string): void;
  /** Feedback line under the board. Never overlays the board. */
  feedback(text: string, tone?: FeedbackTone, icon?: string): void;
  /** Rule break: shake + buzz + haptic + polite live-region announcement */
  ruleBreak(message: string): void;
  /** Polite screen-reader announcement */
  announce(text: string): void;
  /** Register handlers for the controls row (Undo, Hint and game-specific actions) */
  setControls(controls: ControlSpec[]): void;
}

export interface ControlSpec {
  id: string;
  label: string;
  icon: string;
  onPress(): void;
  active?: boolean;
  disabled?: boolean;
  /** primary uses the world colour fill with ink text */
  tone?: "default" | "world" | "gold";
}
