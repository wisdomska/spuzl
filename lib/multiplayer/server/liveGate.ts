import "server-only";
import { ApiError } from "@/lib/api/server";
import { canPlayLive, quickMatchPool, type QuickPool } from "../liveGate";

type BandRow = { age_band?: string | null; birth_year?: number | null; birth_month?: number | null };

/**
 * The server gate for Board Bay "Play live" (join and poll): 16 and over. It reads the effective age band
 * (lib/age), the same reading as every other under-16 rule, so a stale stored band never lets a 15-year-old in.
 */
export function requireLivePlay(player: BandRow, message: string) {
  if (!canPlayLive(player)) throw new ApiError(403, "age_restricted", message);
}

/**
 * R3-06: the server gate for Duel Quick Match (join and poll). Returns the player's pool from the effective band;
 * matchmaking only ever pairs inside one pool, so a 13 to 15 player never meets a 16+ player.
 */
export function requireQuickPool(player: BandRow, message: string): QuickPool {
  const pool = quickMatchPool(player);
  if (!pool) throw new ApiError(403, "age_restricted", message);
  return pool;
}
