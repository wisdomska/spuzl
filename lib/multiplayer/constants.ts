/**
 * Multiplayer timings (Prototype flows c and d, Handoff motion spec, SRS 6 and 12.2). Shared by the
 * server (which schedules rounds with its own clock) and the client (which only renders phases).
 */
export const TIMING = {
  /** D2 versus intro before the first countdown */
  versusMs: 1600,
  /**
   * The default countdown: 3, 2, 1 at 800 ms each, SPUZL! held for 1,600 ms (prototype: 5 ticks of 800 ms). The live
   * length comes from the admin setting party.countdownSeconds (shared by Duel and Party): `countdownMsFor(n)`.
   */
  countdownMs: 4000,
  beatMs: 800,
  /** SPUZL! stays up this long after the last number */
  spuzlHoldMs: 1600,
  /** Party: the server starts a round this much later than the countdown, so a slow phone still sees all of it */
  startBufferMs: 500,
  /** M2 round end card before the next countdown; the live value is the admin setting duel.roundResultMs */
  roundEndMs: 2000,
  /** a ranked round of a game one of the players has never cleared: the rules card's time before the countdown */
  rulesMs: 12_000,
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

/** The countdown numbers (the setting party.countdownSeconds): 2 to 5, 3 by default ("3, 2, 1"). */
export const COUNTDOWN_BEATS = { min: 2, max: 5, default: 3 } as const;

/** Clamps a stored countdown length to the allowed range (a bad value plays the default). */
export function countdownBeats(n: unknown): number {
  return typeof n === "number" && Number.isInteger(n) && n >= COUNTDOWN_BEATS.min && n <= COUNTDOWN_BEATS.max ? n : COUNTDOWN_BEATS.default;
}

/** How long the countdown runs for `beats` numbers: one beat each, then SPUZL! held. 3 beats = TIMING.countdownMs. */
export function countdownMsFor(beats: number): number {
  return countdownBeats(beats) * TIMING.beatMs + TIMING.spuzlHoldMs;
}

/** The number of beats in a countdown of `ms` (the inverse of countdownMsFor). */
export function beatsOfCountdown(ms: number): number {
  return countdownBeats(Math.round((ms - TIMING.spuzlHoldMs) / TIMING.beatMs));
}

export const DUEL_ROUNDS = 3;
export const DUEL_TO_WIN = 2;
export const PARTY_GAMES = 3;
/** A host's hand-picked list: at least two games (one is just "this game"), at most eight. */
export const PARTY_PICK_MIN = 2;
export const PARTY_PICK_MAX = 8;
/**
 * The hard ceiling for a Party room (the database check allows 2 to 10). The live limit is the admin setting
 * party.maxPlayers (default 10): `partyMaxFor(setting)`. Hosts start at PARTY_DEFAULT and can go up to the limit.
 */
export const PARTY_MAX = 10;
export const PARTY_DEFAULT = 8;
export const PARTY_MIN = 2;
/** Rooms with more racers than this send progress at half the rate (TIMING.progressMs doubled), to stay inside the Realtime budget. */
export const PARTY_BUSY_ABOVE = 6;

/** The largest room hosts may open, from the setting party.maxPlayers (a bad value allows the ceiling). */
export function partyMaxFor(n: unknown): number {
  return typeof n === "number" && Number.isInteger(n) && n >= PARTY_MIN && n <= PARTY_MAX ? n : PARTY_MAX;
}

/** Turn games' default limit (Draw It, Two Truths): the setting party.maxPlayersTurns. */
export const PARTY_TURNS_DEFAULT = 8;

/**
 * The largest room a host may open: the Party limit, and for a turn game (Draw It, Two Truths) also its own limit
 * (a bad value plays its default), never above the Party limit.
 */
export function roomLimit(partySetting: unknown, turnsSetting: unknown, turnGame: boolean): number {
  const party = partyMaxFor(partySetting);
  if (!turnGame) return party;
  const turns =
    typeof turnsSetting === "number" && Number.isInteger(turnsSetting) && turnsSetting >= PARTY_MIN && turnsSetting <= PARTY_MAX
      ? turnsSetting
      : PARTY_TURNS_DEFAULT;
  return Math.min(party, turns);
}

/** How often one player's progress goes out in a room of `racers`: twice a second, once a second in a big room. */
export function progressMsFor(racers: number): number {
  return racers > PARTY_BUSY_ABOVE ? TIMING.progressMs * 2 : TIMING.progressMs;
}

/** Preset emotes only (FR-SO-04: no free text). Clients send the index, never the text. */
export const EMOTES = ["🔥", "😂", "😤", "GG", "👏", "😮", "😅", "🤝"] as const;
export type EmoteId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const isEmoteId = (x: unknown): x is EmoteId => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < EMOTES.length;
/** Spoken names for the emote buttons. */
export const EMOTE_LABELS = ["fire", "laughing", "frustrated", "good game", "applause", "wow", "phew", "respect"] as const;
