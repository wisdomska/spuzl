/**
 * Who may play strangers live, read from the effective age band (birth month and year when kept, else the stored
 * band; lib/age).
 * - Board Bay "Play live" (and the big-screen Party view's host line): 16 and over. Under-16s, and anyone whose
 *   band is unknown, are kept out.
 * - Duel Quick Match (R3-06, owner decision 8 Nov 2026): every known band may search, but in a band pool: 13 to 15
 *   players only ever meet other 13 to 15 players, and 16+ players only meet 16+ players. An unknown band can't be
 *   placed in a pool, so it is kept out (the careful reading).
 */
import { bandRank, effectiveBand, type AgeBand } from "@/lib/age";

/** The youngest band allowed into Play live (and the Party TV host line). */
export const LIVE_MIN_BAND: AgeBand = "16-17";

type BandRow = { age_band?: string | null; birth_year?: number | null; birth_month?: number | null };

/** True when this player may join a Board Bay Play live queue (16+). */
export function canPlayLive(row: BandRow, today: Date = new Date()): boolean {
  return bandRank(effectiveBand(row, today)) >= bandRank(LIVE_MIN_BAND);
}

/** Quick Match pools: players are only ever paired inside one pool. */
export const QUICK_POOLS = ["open", "u16"] as const;
export type QuickPool = (typeof QUICK_POOLS)[number];

/** The Quick Match pool for this player: "u16" for 13 to 15, "open" for 16+, null (refused) when the band is unknown. */
export function quickMatchPool(row: BandRow, today: Date = new Date()): QuickPool | null {
  // effectiveBand reads a missing band as 13 to 15; for pairing, a band nobody gave is no band at all.
  if (bandRank(row.age_band) < 0 && !(row.birth_year && row.birth_month)) return null;
  const band = effectiveBand(row, today);
  if (band === "13-15") return "u16";
  return bandRank(band) >= bandRank(LIVE_MIN_BAND) ? "open" : null;
}
