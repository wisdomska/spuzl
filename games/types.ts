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
  // Friendly week: easy most weekdays, a medium midweek and Friday, hard only at the weekend.
  return (["hard", "easy", "easy", "medium", "easy", "medium", "hard"] as const)[day];
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
  /**
   * Optional, guess-transport games: checks a verified final state against what the server recorded on the
   * attempt while it was played (shown answers, committed shots). A reason fails the clear.
   */
  audit?(puzzle: P, solution: S, state: St, log: unknown[]): string | null;
  /**
   * Optional bot check on a verified clear (input timing too regular for a person). A reason flags the clear
   * for moderation instead of ranking it, like the speed checks in lib/game/service.ts finishAttempt.
   */
  suspect?(puzzle: P, solution: S, state: St): string | null;
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
  /** Mode-specific props passed through by the shell, e.g. `ghost` for Ghost Race boards. */
  extra?: Record<string, unknown>;
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
  /**
   * Optional: drive the shell timer from the board's own clock (fixed-step action games). The shell then
   * shows and submits this time instead of wall-clock time, so the player sees exactly what is scored.
   */
  setClock?(clock: (() => number) | null): void;
  /** Optional: the player pressed Start (timed boards with a ready screen). The shell clock starts now. */
  start?(): void;
  /** Optional: slips already made before a resume (restored from the board's saved state), so results stay honest. */
  restoreMistakes?(count: number): void;
  /**
   * Optional: rewrite a server hint's text before the shell shows it (a board whose view differs from the
   * puzzle's own layout, e.g. after Rotate). Pass null to show hint text as sent.
   */
  setHintText?(format: ((hint: Hint) => string) | null): void;
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

/* ---------- Content games (Word Woods, Clue Cave) ---------- */
/**
 * Games built from human-written content also export, from logic.ts, a `generateAt(index, difficulty)`
 * used by the Daily scheduler so consecutive days never repeat an entry. `generate(rng)` (Free play)
 * may pick any entry or build a variant. Content lives in games/<id>/content.ts with `needsReview: true`
 * until the owner approves it in /admin.
 */
export interface ContentLogic<P, S, St> extends GameLogic<P, S, St> {
  contentCount: number;
  generateAt(index: number, difficulty: Difficulty): Generated<P, S>;
}

/* ---------- Board Bay matches (live and async), server-validated ---------- */
export interface MatchStatus {
  over: boolean;
  /** seat index of the winner, null for a draw or while running */
  winner: number | null;
  reason?: string;
}
export interface BoardGameRules<S, M> {
  id: string;
  seats: { min: number; max: number };
  initial(seats: number, rng: Rng): S;
  /** whose turn (seat index) */
  turn(state: S): number;
  legalMoves(state: S, seat: number): M[];
  isLegal(state: S, seat: number, move: M): boolean;
  /** pure; throws on an illegal move */
  apply(state: S, seat: number, move: M, rng: Rng): S;
  status(state: S): MatchStatus;
  /** optional simple AI for the clearly labelled "Practice bot" fallback */
  botMove?(state: S, seat: number, rng: Rng): M;
}

/* ---------- Action games (Rage Ridge) ---------- */
/**
 * Action games submit an input log, not a board. logic.verify re-simulates the run with a deterministic
 * fixed-step simulation (phaser/sim), so a forged time or death count is rejected. Phaser only renders.
 */
export interface InputLog {
  /** fixed simulation step in ms (1000 / 60) */
  step: number;
  /** [frame, buttonsBitmask] pairs, only when buttons change */
  events: [number, number][];
  frames: number;
}
