/**
 * Low-data images (FR-ST-03 "smaller images", Handoff low-data mode).
 *
 * - 3D game tiles: public/3d/icons is 216 px (3x for 72 px tiles); public/3d/icons-sm is 108 px
 *   (half the bytes), generated from the same renders.
 * - Share cards: the OG routes render at half size with `size=small`.
 *
 *   <img src={gameIconSrc("crownfall", lowData)} />
 *   <img src={smallCardSrc(url, lowData)} />
 */
export function gameIconSrc(gameId: string, lowData: boolean): string {
  return `/3d/${lowData ? "icons-sm" : "icons"}/${gameId}.webp`;
}

/** Adds `size=small` to a share card URL in low-data mode. */
export function smallCardSrc(url: string, lowData: boolean): string {
  if (!lowData || /[?&]size=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}size=small`;
}
