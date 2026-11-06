import "server-only";
import { ApiError } from "@/lib/api/server";
import { canPlayLive } from "../liveGate";

/**
 * The one server gate for Duel Quick Match and Board Bay "Play live" (join and poll). It reads the effective age
 * band (lib/age), the same reading as every other under-16 rule, so a stale stored band never lets a 15-year-old in.
 */
export function requireLivePlay(
  player: { age_band?: string | null; birth_year?: number | null; birth_month?: number | null },
  message: string,
) {
  if (!canPlayLive(player)) throw new ApiError(403, "age_restricted", message);
}
