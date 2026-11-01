/** Guided first play: which games this device has already learned (or skipped the lesson for). */
const KEY = "spuzl.learned";

export function learnedGames(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function markLearned(id: string) {
  try {
    const s = learnedGames();
    s.add(id);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* storage blocked: the guided round may show again, still skippable */
  }
}

/**
 * The first try of a game starts with a short hinted practice round, unless the player has cleared it before
 * (any device), already learned or skipped it here, or is resuming a started attempt.
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
