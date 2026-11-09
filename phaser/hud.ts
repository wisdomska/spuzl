/** What the Rage Ridge board shows over and under the canvas (deaths, distance, score, the ghost read, the level). */
export interface Hud {
  deaths: number;
  metres: number;
  score: number;
  progress: number;
  ghostProgress: number;
  delta: number | null;
  level: string;
  cleared: number;
  started: boolean;
  finished: boolean;
}

/**
 * The HUD is read 10 times a second. Most reads change nothing (before the first move, paused, standing still), and
 * a new object every time re-rendered the whole board for nothing; the board keeps the old one when this is true.
 */
export function sameHud(a: Hud, b: Hud): boolean {
  return (
    a.deaths === b.deaths &&
    a.metres === b.metres &&
    a.score === b.score &&
    a.progress === b.progress &&
    a.ghostProgress === b.ghostProgress &&
    a.delta === b.delta &&
    a.level === b.level &&
    a.cleared === b.cleared &&
    a.started === b.started &&
    a.finished === b.finished
  );
}
