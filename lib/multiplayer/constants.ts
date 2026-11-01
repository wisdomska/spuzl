/**
 * Multiplayer timings (Prototype flows c and d, Handoff motion spec, SRS 6 and 12.2). Shared by the
 * server (which schedules rounds with its own clock) and the client (which only renders phases).
 */
export const TIMING = {
  /** D2 versus intro before the first countdown */
  versusMs: 1600,
  /** 3, 2, 1 at 800 ms each, SPUZL! held for 1,600 ms (prototype: 5 ticks of 800 ms) */
  countdownMs: 4000,
  beatMs: 800,
  /** M2 round end card before the next countdown; the live value is the admin setting duel.roundResultMs */
  roundEndMs: 2000,
  /** tie window: finishes in the same tenth of a second */
  tieMs: 100,
  /** the server waits this long after the first finish before deciding, so near ties are seen */
  settleMs: 180,
  /** SRS 6: reconnect window; abandoning counts as a loss */
  reconnectMs: 20_000,
  /** no heartbeat for this long: the opponent shows as disconnected and clocks pause */
  staleMs: 6_000,
  /** clients send progress at most twice a second, and at least every 3 s as a heartbeat */
  progressMs: 500,
  heartbeatMs: 3_000,
  /** SRS 12.2: Practice bot after 20 s of matchmaking */
  botAfterMs: 20_000,
  /** Party: the race closes 90 s after the first finish, or after 8 minutes */
  raceAfterFirstMs: 90_000,
  raceCapMs: 8 * 60_000,
  /** Party rooms expire 2 h after they empty (Handoff rule: room codes) */
  roomTtlMs: 2 * 60 * 60_000,
  /** Board Bay async: 24 h per move, nudge after 12 h */
  asyncMoveMs: 24 * 60 * 60_000,
  nudgeAfterMs: 12 * 60 * 60_000,
} as const;

export const DUEL_ROUNDS = 3;
export const DUEL_TO_WIN = 2;
export const PARTY_GAMES = 3;
/** A host's hand-picked list: at least two games (one is just "this game"), at most eight. */
export const PARTY_PICK_MIN = 2;
export const PARTY_PICK_MAX = 8;
export const PARTY_MAX = 8;
export const PARTY_MIN = 2;

/** Preset emotes only (FR-SO-04: no free text). Clients send the index, never the text. */
export const EMOTES = ["🔥", "😂", "😤", "GG"] as const;
export type EmoteId = 0 | 1 | 2 | 3;
export const isEmoteId = (x: unknown): x is EmoteId => x === 0 || x === 1 || x === 2 || x === 3;
