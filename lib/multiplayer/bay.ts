/**
 * Board Bay matches (live and async), validated on the server with each game's BoardGameRules.
 * Moves are applied with a deterministic rng per ply (`<seed>:<ply>`), so the state can always be
 * rebuilt from the move log (takebacks, audits). Pure: no database, no React.
 */
import type { BoardGameRules, MatchStatus } from "@/games/types";
import { createRng } from "@/lib/rng";
import { TIMING } from "./constants";

export const BAY_GAMES = ["chess", "draughts", "oware", "ludo", "fourup", "flip"] as const;
export type BayGame = (typeof BAY_GAMES)[number];
export const isBayGame = (g: string): g is BayGame => (BAY_GAMES as readonly string[]).includes(g);

/** Live clocks (B3 shows 5 minute games); async has none. */
export const LIVE_CLOCK_MS = 5 * 60_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRules = BoardGameRules<any, any>;

export async function loadRules(game: BayGame): Promise<AnyRules> {
  switch (game) {
    case "chess":
      return (await import("@/games/chess/rules")).default;
    case "draughts":
      return (await import("@/games/draughts/rules")).default;
    case "oware":
      return (await import("@/games/oware/rules")).default;
    case "ludo":
      return (await import("@/games/ludo/rules")).default;
    case "fourup":
      return (await import("@/games/fourup/rules")).default;
    case "flip":
      return (await import("@/games/flip/rules")).default;
  }
}

export const initialState = (rules: AnyRules, seats: number, seed: string) => rules.initial(seats, createRng(`${seed}:init`));

export interface MoveVerdict {
  ok: boolean;
  reason?: "not_your_turn" | "illegal" | "game_over" | "malformed";
  next?: unknown;
  status?: MatchStatus;
}

/** Validates and applies one move. Never throws: an illegal move comes back as `ok: false`. */
export function validateMove(rules: AnyRules, state: unknown, seat: number, move: unknown, seed: string, ply: number): MoveVerdict {
  if (move === undefined || move === null) return { ok: false, reason: "malformed" };
  let st: MatchStatus;
  try {
    st = rules.status(state);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (st.over) return { ok: false, reason: "game_over" };
  if (rules.turn(state) !== seat) return { ok: false, reason: "not_your_turn" };
  let legal = false;
  try {
    legal = rules.isLegal(state, seat, move);
  } catch {
    legal = false;
  }
  if (!legal) return { ok: false, reason: "illegal" };
  try {
    const next = rules.apply(state, seat, move, createRng(`${seed}:${ply}`));
    return { ok: true, next, status: rules.status(next) };
  } catch {
    return { ok: false, reason: "illegal" };
  }
}

/** Rebuilds the state after the first `upTo` moves of the log. */
export function replayMoves(rules: AnyRules, seats: number, seed: string, moves: { seat: number; move: unknown }[], upTo = moves.length) {
  let s = initialState(rules, seats, seed);
  for (let i = 0; i < upTo; i++) s = rules.apply(s, moves[i].seat, moves[i].move, createRng(`${seed}:${i}`));
  return s;
}

/**
 * How many plies to take back so it is the requester's move again: one when the requester made the
 * last move, two when the opponent has already replied. Ludo turns are rolls and moves, so ludo
 * never offers takebacks (B notes: takebacks only in unranked friend games of chess-like games).
 */
export function takebackPlies(moves: { seat: number }[], requester: number): number {
  if (!moves.length) return 0;
  if (moves[moves.length - 1].seat === requester) return 1;
  if (moves.length >= 2 && moves[moves.length - 2].seat === requester) return 2;
  return 0;
}

/** Live clock: remaining ms for every seat after `seat` used `elapsedMs`. Never below 0. */
export function spendClock(clock: number[], seat: number, elapsedMs: number): number[] {
  return clock.map((ms, i) => (i === seat ? Math.max(0, ms - Math.max(0, elapsedMs)) : ms));
}

/** Seat whose flag fell, if any, given the clock at the turn start and the time since. */
export function flagFallen(clock: number[] | null, turn: number, turnStartedAt: number, now: number): boolean {
  if (!clock) return false;
  return clock[turn] - (now - turnStartedAt) <= 0;
}

/** Async: a nudge is allowed once, on the opponent's turn, 12 h or more after their turn began. */
export function canNudge(m: { myTurn: boolean; turnStartedAt: number; nudgedAt: number | null }, now: number): boolean {
  return !m.myTurn && m.nudgedAt === null && now - m.turnStartedAt >= TIMING.nudgeAfterMs;
}

export const asyncDeadline = (now: number) => new Date(now + TIMING.asyncMoveMs).toISOString();
