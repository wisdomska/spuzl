import { GAME_BY_ID } from "@/lib/catalog";
import { formatNumber, formatShort } from "@/lib/format";
import { tierMeta } from "@/lib/leagues";
import { weeklyRecapCopy as T } from "@/lib/copy/weekly-recap";
import { weekLabels, type WeeklyRecap } from "@/lib/recap/weekly";
import { ordinal } from "./card-model";
import { SHARE_DOMAIN } from "./text";

/**
 * Weekly recap card (R3-10): the 1080 × 1920 story frame (same size, ink, dot grid and fonts as the R2-P5 story
 * cards), with the week's clears as the big number and up to four stat tiles. Pure: the server fills it from the
 * player's rows for that week (lib/recap/weekly.server.ts), never from the query string.
 *
 * Privacy, as on the status card: no nickname at all, no league for under-16s, no streak while "Hide my activity"
 * is on.
 */
export const RECAP_CARD_SIZE = { width: 1080, height: 1920 } as const;

export interface RecapStat {
  id: "best" | "streak" | "league" | "sparks";
  label: string;
  value: string;
}

export interface RecapCardModel {
  kind: "recap";
  bg: string;
  dot: string;
  fg: string;
  z: string;
  spuz: string;
  mood: "party" | "proud" | "cheer";
  kicker: string;
  range: string;
  big: string;
  line: string;
  stats: RecapStat[];
  alt: string;
}

export interface RecapCardOptions {
  /** 13-15: no league on a public card */
  minor: boolean;
  /** "Hide my activity": no streak */
  hideActivity: boolean;
}

/** The stats shown on Home and on the card, in order. Pure. */
export function recapStats(r: WeeklyRecap, o: RecapCardOptions): RecapStat[] {
  const out: RecapStat[] = [];
  if (r.best)
    out.push({ id: "best", label: T.best, value: T.bestValue(formatShort(r.best.ms), GAME_BY_ID[r.best.game]?.name ?? r.best.game) });
  if (!o.hideActivity) out.push({ id: "streak", label: T.streak, value: r.streak > 0 ? `🔥 ${T.streakValue(r.streak)}` : T.streakNone });
  if (!o.minor && r.league) {
    const tier = tierMeta(r.league.tier).name;
    const value = r.league.result
      ? r.league.result === "promoted"
        ? T.leagueValue.promoted(tierMeta(r.league.tier + 1).name)
        : r.league.result === "demoted"
          ? T.leagueValue.demoted(tierMeta(Math.max(0, r.league.tier - 1)).name)
          : T.leagueValue.stayed(tier)
      : r.league.rank
        ? T.leagueRank(ordinal(r.league.rank))
        : tier;
    out.push({ id: "league", label: T.league, value });
  }
  out.push({ id: "sparks", label: T.sparks, value: T.sparksValue(formatNumber(r.sparks)) });
  return out;
}

export function recapCard(r: WeeklyRecap, o: RecapCardOptions): RecapCardModel {
  const { from, to } = weekLabels(r.week);
  return {
    kind: "recap",
    bg: "#0E0F1A",
    dot: "#22253C",
    fg: "#F4F5FB",
    z: "#B8F23A",
    spuz: "#B8F23A",
    mood: r.cleared >= 10 ? "party" : r.cleared >= 3 ? "proud" : "cheer",
    kicker: T.cardKicker,
    range: T.range(from, to),
    big: formatNumber(r.cleared),
    line: T.bigLine(r.cleared),
    stats: recapStats(r, o),
    alt: T.alt(r.cleared),
  };
}

/** Spoiler-free share text: the week's clears and the site, nothing about the player. */
export const recapShareText = (r: Pick<WeeklyRecap, "cleared">) => T.shareText(r.cleared, SHARE_DOMAIN);

/** Design sample for the dev preview route and tests. */
export const SAMPLE_RECAP: RecapCardModel = recapCard(
  {
    week: "2026-11-02",
    cleared: 12,
    best: { game: "crownfall", ms: 42_000 },
    streak: 12,
    league: { tier: 1, rank: 4, result: "promoted" },
    sparks: 145,
  },
  { minor: false, hideActivity: false },
);
