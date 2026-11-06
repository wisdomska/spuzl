/**
 * Who may play strangers live: Duel Quick Match and Board Bay "Play live". One rule for the server gates and the
 * screens that show them, read from the effective age band (birth month and year when kept, else the stored band;
 * lib/age). Under-16s, and anyone whose band is unknown, are kept out: they challenge friends instead.
 */
import { bandRank, effectiveBand, type AgeBand } from "@/lib/age";

/** The youngest band allowed into Quick Match and Play live. */
export const LIVE_MIN_BAND: AgeBand = "16-17";

type BandRow = { age_band?: string | null; birth_year?: number | null; birth_month?: number | null };

/** True when this player may join a Quick Match or Play live queue. */
export function canPlayLive(row: BandRow, today: Date = new Date()): boolean {
  return bandRank(effectiveBand(row, today)) >= bandRank(LIVE_MIN_BAND);
}
