/**
 * The game shell's clocks (R2-15), as plain arithmetic over `performance.now()` readings so they can be tested.
 *
 * - The play clock (the one header timer, and the time a clear reports) starts on the first move, never on board
 *   load, and stops while the game is held (Pause, the menu, How to play, a hint confirm, the leave confirm).
 * - The look clock counts the time the board was on screen and not held, from the moment it appears, first move or
 *   not. It goes to the server with a clear as `boardMs`, so the fast-solve floor still sees the thinking a player
 *   did before their first move (lib/game/anticheat.ts). It never feeds the timer or the score.
 *
 * Both start and stop synchronously, so a move that solves the puzzle in the same tick as it starts the clock still
 * reads a real time.
 */
export interface ShellClock {
  /** ms counted before the current run */
  base: number;
  /** when the current run started (only while `on`) */
  since: number;
  on: boolean;
}

export const newClock = (base = 0): ShellClock => ({ base, since: 0, on: false });

/** Starts the clock at time `t` (no-op while it runs). */
export function runClock(c: ShellClock, t: number) {
  if (c.on) return;
  c.since = t;
  c.on = true;
}

/** Stops the clock at time `t`, keeping what it counted (no-op while stopped). */
export function haltClock(c: ShellClock, t: number) {
  if (!c.on) return;
  c.base += Math.max(0, t - c.since);
  c.on = false;
}

/** The time counted so far, read at time `t`. */
export function readClock(c: ShellClock, t: number): number {
  return c.on ? c.base + Math.max(0, t - c.since) : c.base;
}
