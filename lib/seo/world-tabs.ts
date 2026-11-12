/**
 * The /games world tabs (R6): which tab a link opens and where the arrow keys go. Pure, so it is unit tested.
 * The selected world lives in the URL hash ("/games#word"), so a tab can be linked and Back/Forward follow it.
 */

/** The tab a hash names ("#word" or "word"), or the first tab when it names none of them. */
export function tabFromHash(hash: string, ids: readonly string[]): string | undefined {
  let id = hash.replace(/^#/, "");
  try {
    id = decodeURIComponent(id);
  } catch {
    /* a malformed escape: compare it as typed */
  }
  id = id.trim().toLowerCase();
  return ids.includes(id) ? id : ids[0];
}

/** The index a key moves the selection to (WAI-ARIA tabs: arrows wrap, Home and End jump), or null for other keys. */
export function tabIndexForKey(key: string, i: number, n: number): number | null {
  if (n < 1) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (i + 1) % n;
    case "ArrowLeft":
    case "ArrowUp":
      return (i - 1 + n) % n;
    case "Home":
      return 0;
    case "End":
      return n - 1;
    default:
      return null;
  }
}
