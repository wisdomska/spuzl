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
 * The first try of a game starts with a short hinted practice round, unless the player has cleared it before
 * (any device), already learned or skipped it (this device or the account), or is resuming a started attempt.
 */
export function needsGuided(o: {
  id: string;
  mode: string;
  played: readonly string[] | undefined;
  learned: Set<string>;
  started: boolean;
  available: boolean;
}): boolean {
  if (!o.available || o.started) return false;
  if (o.mode !== "daily" && o.mode !== "free" && o.mode !== "archive") return false;
  if (!o.played) return false; // unknown yet: never block play on it
  return !o.played.includes(o.id) && !o.learned.has(o.id);
}
