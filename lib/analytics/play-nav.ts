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

/**
 * R2-12: marks a real link whose plain tap opens a sheet in place (a Library row: `<a href="/play/x">` that opens
 * the game card). Long-press, Ctrl/Cmd-click and middle-click still open the link, but a plain tap is not a
 * navigation, so the document-level tap listeners (attempt priming, the low-data load timer) leave it alone.
 */
export const SHEET_LINK_ATTR = "data-sheet-link";
export const SHEET_LINK = { [SHEET_LINK_ATTR]: "" } as const;

/** Pure: whether a tapped element, or an ancestor, is a sheet link. */
export function isSheetLink(target: Pick<Element, "closest"> | null | undefined): boolean {
  return typeof target?.closest === "function" && target.closest(`[${SHEET_LINK_ATTR}]`) !== null;
}
