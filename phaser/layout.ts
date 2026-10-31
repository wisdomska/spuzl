/**
 * Rage Ridge canvas height. The base size follows the board width; on a phone held upright the canvas
 * grows to at least 60 % of the viewport height (487 px on a 375 x 812 screen) so the course reads at
 * thumb distance, while the shell header above it stays on screen.
 */
export const PHONE_MAX_WIDTH = 640;
export const PHONE_MIN_VIEWPORT_SHARE = 0.6;

export function stageHeight(width: number, viewport: { w: number; h: number }, tall = false): number {
  const base = tall ? Math.round(Math.max(300, Math.min(400, width * 0.9))) : Math.round(Math.max(230, Math.min(320, width * 0.7)));
  const phone = viewport.w < PHONE_MAX_WIDTH && viewport.h > viewport.w;
  return phone ? Math.max(base, Math.ceil(viewport.h * PHONE_MIN_VIEWPORT_SHARE)) : base;
}
