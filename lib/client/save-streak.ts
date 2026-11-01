/**
 * Guest safety net (SPZ-20): when a guest should see "Save your streak". Clears come from the server
 * (`me.clears`); only the dismissal lives on this phone (re-asked at most once a week).
 */
export const SAVE_PROMPT_KEY = "spuzl.saveStreak.dismissedAt";
export const SAVE_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldAskToSave(input: {
  guest: boolean | undefined;
  clears: number | undefined;
  /** the `guest.signInPromptAfterClears` game setting; 0 turns the prompt off */
  after: number;
  dismissedAt: number | null;
  now: number;
}): boolean {
  const { guest, clears, after, dismissedAt, now } = input;
  if (!guest || after <= 0 || clears === undefined || clears < after) return false;
  return dismissedAt === null || now - dismissedAt >= SAVE_PROMPT_SNOOZE_MS;
}

export function readDismissedAt(): number | null {
  try {
    const v = Number(localStorage.getItem(SAVE_PROMPT_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeDismissedAt(at: number) {
  try {
    localStorage.setItem(SAVE_PROMPT_KEY, String(at));
  } catch {}
}
