/**
 * The finish's timing checks (SRS 12.3), pure so they can be tested (lib/game/service.ts `finishAttempt`).
 *
 * R2-15 moved the client's clock start from board load to the first move, so `activeMs` (the time shown and ranked)
 * no longer includes the thinking before that move. The checks stay correct like this:
 * - Client time > wall clock: `activeMs` only got smaller, and the server's wall clock still runs from `started_at`
 *   (the attempt's creation, at or before the board appearing), so an honest clear never trips it.
 * - The fast-solve floor (`minTimeMs`) is about how fast a person can see and solve a board, not how fast they move
 *   once they have studied it. It reads the look time: the board on screen and not paused (`boardMs`, from the
 *   client), never less than `activeMs` and never more than the wall clock (plus slack), so a client cannot claim
 *   more look time than the server saw pass. An old client that sends no `boardMs` is judged on `activeMs`, as before.
 */
export const WALL_SLACK_MS = 3000;

export interface TimingInput {
  /** the play clock: first move to clear, pauses excluded (what the player sees and what ranks) */
  activeMs: number;
  /** the board on screen and not paused, from load to clear (R2-15); optional for older clients */
  boardMs?: number;
  /** server wall time from the attempt's start to the finish */
  wallMs: number;
  /** the game's fast-solve floor for this attempt */
  floorMs: number;
}

/** The time the floor judges: the look time, clamped to [activeMs, wallMs + slack]. */
export function lookMs(t: Pick<TimingInput, "activeMs" | "boardMs" | "wallMs">): number {
  const active = Math.max(0, t.activeMs);
  if (t.boardMs === undefined || !Number.isFinite(t.boardMs)) return active;
  return Math.max(active, Math.min(t.boardMs, Math.max(0, t.wallMs) + WALL_SLACK_MS));
}

/** A timing flag for this clear, or null when the times are possible. */
export function timingFlag(t: TimingInput): string | null {
  const timeMs = Math.max(0, Math.round(t.activeMs));
  const seen = Math.round(lookMs(t));
  if (seen < t.floorMs) return `below human floor (${seen} < ${t.floorMs} ms)`;
  if (timeMs > t.wallMs + WALL_SLACK_MS) return `client time ${timeMs} exceeds server wall time ${t.wallMs}`;
  return null;
}
