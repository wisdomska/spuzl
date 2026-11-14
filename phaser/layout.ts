import { isWide } from "@/components/game/useBoardSize";

/**
 * Rage Ridge canvas height. The base size follows the board width; on a phone held upright the canvas
 * grows to at least 60 % of the viewport height (487 px on a 375 x 812 screen) so the course reads at
 * thumb distance, while the shell header above it stays on screen. That is the ideal height: on short
 * phones the board then gives some of it back (down to MIN_STAGE_HEIGHT, see `useFitHeight`) so the
 * on-screen controls under the canvas stay above the fold, and the controls themselves get smaller.
 */
export const PHONE_MAX_WIDTH = 640;
export const PHONE_MIN_VIEWPORT_SHARE = 0.6;
/** The canvas never shrinks under this to fit a short screen (about 210 px is what a 320 x 568 phone leaves). */
export const MIN_STAGE_HEIGHT = 200;
/** Viewports shorter than this get the smaller D-pad (56 px) and action button (80 px). */
export const SHORT_VIEWPORT = 700;

export function stageHeight(width: number, viewport: { w: number; h: number }, tall = false): number {
  // The two-column shell on a wide screen: the canvas keeps the course's proportions at the column's width
  // (the height fit then gives back what the controls under it need).
  if (isWide(viewport.w, viewport.h)) return Math.round(Math.max(320, width * (tall ? 0.9 : 0.7)));
  const base = tall ? Math.round(Math.max(300, Math.min(400, width * 0.9))) : Math.round(Math.max(230, Math.min(320, width * 0.7)));
  const phone = viewport.w < PHONE_MAX_WIDTH && viewport.h > viewport.w;
  return phone ? Math.max(base, Math.ceil(viewport.h * PHONE_MIN_VIEWPORT_SHARE)) : base;
}

/**
 * Canvas height for a board that shows one whole room of `cols` x `rows` tiles (Gotcha): the room at the board's
 * width, plus `chrome` css px for the HUD above it and the edge below, never taller than `stageHeight` would make
 * it. A phone then gets the room and its controls close together instead of a tall canvas that is mostly sky.
 */
export function roomStageHeight(width: number, viewport: { w: number; h: number }, cols: number, rows: number, chrome: number): number {
  const fit = Math.ceil(chrome + (rows * width) / cols);
  return Math.max(MIN_STAGE_HEIGHT, Math.min(stageHeight(width, viewport), fit));
}
