/**
 * Leaving a game, by mode (owner rule "exit games anyhow"): every route out (Back, the menu's Leave game, the
 * browser or phone back gesture, Escape) follows the same policy.
 *
 * - Solo play (free play, levels, guided practice, games vs the device bot, an async Board Bay game): leave at
 *   once. Progress is saved and the game card offers Resume.
 * - A timed scored run that has started (TIMED_RUNS): one light confirm. Leaving leaves the attempt unfinished
 *   (the server's housekeeping marks it abandoned later); nothing is awarded.
 * - A live match against people (Duel, live Board Bay, Party race): a confirm, then the existing leave or resign
 *   call so the other side is told at once.
 * - A Practice-bot Duel: no confirm (nothing is lost), but the leave call still ends the match on the server.
 * - Anything already over: leave at once.
 */

/** Games whose solo run is timed and scored, so leaving part way loses it. */
export const TIMED_RUNS: ReadonlySet<string> = new Set(["quickfire", "echo", "flinch", "beattap", "gotcha", "dash", "gauntlet"]);

export type LeaveContext =
  /** free play, levels, a Daily or archive puzzle, a challenge or ghost race */
  | "solo"
  /** the guided first play */
  | "guided"
  /** a casual full game against the device bot (/play/<id>/bot) */
  | "bot"
  | "duel"
  | "duel-bot"
  | "party"
  | "bay-live"
  | "bay-async"
  | "bay-bot";

export type LeaveKind = "none" | "run" | "match" | "party";

export interface LeaveInput {
  context: LeaveContext;
  game?: string;
  /** the player has made a move or pressed Start (a run that never started costs nothing) */
  started?: boolean;
  /** the game, run or match is over */
  over?: boolean;
}

export interface LeavePolicy {
  /** which confirm to show, "none" for no confirm */
  kind: LeaveKind;
  /** the screen must call its leave or resign endpoint on the way out */
  forfeit: boolean;
  /** a history entry guards the browser back gesture (only while a confirm is needed) */
  guard: boolean;
}

const NONE: LeavePolicy = { kind: "none", forfeit: false, guard: false };

export function leavePolicy({ context, game, started = false, over = false }: LeaveInput): LeavePolicy {
  if (over) return NONE;
  switch (context) {
    case "duel":
    case "bay-live":
      return { kind: "match", forfeit: true, guard: true };
    case "party":
      return { kind: "party", forfeit: true, guard: true };
    case "duel-bot":
      return { kind: "none", forfeit: true, guard: false };
    case "solo":
      return started && game !== undefined && TIMED_RUNS.has(game) ? { kind: "run", forfeit: false, guard: true } : NONE;
    default:
      return NONE;
  }
}
