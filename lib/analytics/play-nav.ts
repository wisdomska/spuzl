/**
 * Marks a button or link that opens the Play screen, for the tap-to-board metric (tap-to-board.ts). Only taps
 * on these are stamped, so a tap on anything else (a filter, a sheet, a settings toggle) is never read as the
 * start of a board load. Spread it on the element: `<Link href="/play/x" {...PLAY_NAV}>`.
 *
 * Plain module (no "use client"), so server components can spread it too. Bot games (/play/<id>/bot) are not
 * marked: their screen does not report tap-to-board.
 */
export const PLAY_NAV_ATTR = "data-play-nav";
export const PLAY_NAV = { [PLAY_NAV_ATTR]: "" } as const;

/** Pure: whether a tapped element, or an ancestor, is a Play navigation. */
export function isPlayNav(target: Pick<Element, "closest"> | null | undefined): boolean {
  return typeof target?.closest === "function" && target.closest(`[${PLAY_NAV_ATTR}]`) !== null;
}
