/**
 * How Ghost Race ranks two runs of the same track. Course games (scored on deaths) rank fewest deaths, then the
 * faster clear. An endless runner (Dash, scored on distance) ends every run on its one crash, and on one track the
 * speed depends on distance only, so the run that lasted longer went farther: longest time wins.
 */
import { GAME_BY_ID } from "@/lib/catalog";

export interface GhostRunStats {
  timeMs: number;
  deaths: number;
}

/** True when the game's ghosts rank by distance (the longest run), not by deaths and time. */
export const ghostByDistance = (game: string) => GAME_BY_ID[game]?.scoring === "score";

/** True when `run` beats `ghost` (no ghost: any finished run sets one). */
export function beatsGhost(game: string, run: GhostRunStats, ghost: GhostRunStats | null): boolean {
  if (!ghost) return true;
  if (ghostByDistance(game)) return run.timeMs > ghost.timeMs;
  return run.deaths < ghost.deaths || (run.deaths === ghost.deaths && run.timeMs < ghost.timeMs);
}
