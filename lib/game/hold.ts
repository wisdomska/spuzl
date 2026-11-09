/**
 * When the game shell holds a game (R2-15, R2-16): the clocks stop and the board is covered. Held by Pause, the
 * game menu (only where the mode can pause), How to play or another sheet over the game, the hint confirm and the
 * leave confirm (only where the mode can pause). A cleared board is never covered: it is held up on purpose.
 */
export interface HoldInput {
  paused: boolean;
  /** another overlay (How to play) is open */
  external: boolean;
  confirmHint: boolean;
  menuOpen: boolean;
  leaveAsking: boolean;
  canPause: boolean;
  solved: boolean;
}

export function holdState(o: HoldInput): { held: boolean; covered: boolean } {
  const held = o.paused || o.external || o.confirmHint || (o.canPause && ((o.menuOpen && !o.solved) || o.leaveAsking));
  return { held, covered: held && !o.solved };
}

/**
 * What hiding the tab does (owner decision, 9 Nov): solo play pauses itself; a live Duel or Race can't pause (the
 * opponent and the server clock go on), so it never shows the Pause sheet and says "the round kept going" on return.
 * Nothing before the first move or after the end.
 */
export function onTabHidden(o: { canPause: boolean; started: boolean; solved: boolean }): "pause" | "away" | "none" {
  if (!o.started || o.solved) return "none";
  return o.canPause ? "pause" : "away";
}
