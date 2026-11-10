/**
 * Guided first play: which games the player has already learned (or skipped the lesson for). The account keeps
 * them (`Me.learned`, saved through POST /api/v1/me/learned) so a new device doesn't replay practice rounds;
 * this device keeps its own copy too, which works before sign-in and offline.
 */
const KEY = "spuzl.learned";

/** Games learned on this device. */
export function learnedGames(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Adds games to this device's copy. */
export function rememberLearned(ids: Iterable<string>) {
  try {
    const s = learnedGames();
    for (const id of ids) s.add(id);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* storage blocked: the account copy (or a skip) still covers it */
  }
}

export function markLearned(id: string) {
  rememberLearned([id]);
}

/** Learned anywhere: on this device or on the account. */
export function allLearned(device: Set<string>, account: readonly string[] | undefined): Set<string> {
  return new Set([...device, ...(account ?? [])]);
}

/** Games this device learned that the account doesn't have yet (learned before sign-in, or while offline). */
export function learnedToSync(device: Set<string>, account: readonly string[] | undefined): string[] {
  if (!account) return []; // account not loaded yet: nothing to compare
  const known = new Set(account);
  return [...device].filter((id) => !known.has(id));
}

/**
 * R2-07: every solo way into a game runs the practice round on its first open: the Daily (and the Daily Five),
 * free play (Library, deep links), the archive, levels (Continue opens ladder games in level mode) and a game
 * against the bot. R4-19 (owner decision, 10 Nov 2026): a friend's challenge (/challenge/<code>) and a Ghost Race
 * (/ghost/<game>) too, before the real run starts (their clock and attempt begin only after it). Live rounds (Duel,
 * Party) never wait for it: they get the "How it works" card instead.
 */
export const PRACTICE_MODES: readonly string[] = ["daily", "five", "free", "archive", "level", "bot", "challenge", "ghost"];

/** The player knows this game: cleared it once (any device), or learned or skipped its practice round. */
export function knowsGame(id: string, played: readonly string[] | undefined, learned: Set<string>): boolean {
  return learned.has(id) || !!played?.includes(id);
}

/**
 * The first try of a game starts with a short hinted practice round, unless the player knows the game, is resuming
 * a started attempt, the game has no practice board, or the admin turned its practice round off
 * ("practice.disabled").
 */
export function needsGuided(o: {
  id: string;
  mode: string;
  played: readonly string[] | undefined;
  learned: Set<string>;
  started: boolean;
  available: boolean;
  disabled?: readonly string[];
}): boolean {
  if (!o.available || o.started || o.disabled?.includes(o.id)) return false;
  if (!PRACTICE_MODES.includes(o.mode)) return false;
  if (!o.played) return false; // unknown yet: never block play on it
  return !knowsGame(o.id, o.played, o.learned);
}

/**
 * Live rounds (Duel, Party): a game the player does not know gets a 10-second "How it works" card over the start of
 * the round (a live round never waits for a practice round).
 */
export function needsHowItWorks(o: {
  id: string;
  played: readonly string[] | undefined;
  learned: Set<string>;
  disabled?: readonly string[];
}): boolean {
  if (o.disabled?.includes(o.id) || !o.played) return false;
  return !knowsGame(o.id, o.played, o.learned);
}

/**
 * Should a tap on a link to this game start its attempt at once (lib/client/early-attempt.ts)? Not while the
 * practice round comes first: the attempt would sit unused (and a primed Daily would start its clock on the server).
 * Account not known yet: only games learned on this device are primed.
 */
export function shouldPrime(o: {
  id: string;
  played: readonly string[] | undefined;
  learned: Set<string>;
  available: boolean;
  disabled?: readonly string[];
}): boolean {
  if (!o.available || o.disabled?.includes(o.id)) return true;
  return knowsGame(o.id, o.played, o.learned);
}

export type PracticeEvent = "practice_start" | "practice_finish" | "practice_skip";
export type PracticeRecord = { start: boolean; end: boolean };

/**
 * Admin Metrics, practice rounds (R2-ADMIN): which of GuidedPlay's events to send. One start per practice board,
 * then at most one ending (a finish or a skip, whichever comes first), never an ending without a start. A start
 * with no ending is a drop-off. Returns whether to send, and the record after it.
 */
export function practiceStep(r: PracticeRecord, event: PracticeEvent): { send: boolean; next: PracticeRecord } {
  if (event === "practice_start") return r.start ? { send: false, next: r } : { send: true, next: { ...r, start: true } };
  if (!r.start || r.end) return { send: false, next: r };
  return { send: true, next: { ...r, end: true } };
}
