import type { SpuzMood } from "@/components/brand/Spuz";
import { GAME_BY_ID, WORLDS, WORLD_BY_ID, type WorldId } from "@/lib/catalog";
import { formatNumber, formatShort } from "@/lib/format";

/**
 * Share card view model (design: States Share Light Desktop, "Share cards").
 * Pure: the server loaders in lib/share/cards.ts fill it from database rows, never from the query string.
 */
export type CardKind = "daily" | "full" | "duel" | "party";
export type CardFormat = "story" | "square";

export interface CardModel {
  kind: CardKind;
  bg: string;
  /** dot-grid colour */
  dot: string;
  fg: string;
  /** colour of the Z in the wordmark */
  z: string;
  mood: SpuzMood;
  spuz: string;
  kicker: string;
  big: string;
  /** big number size on the 1080 × 1920 card */
  bigFs: number;
  /** big number size on the 1080 × 1080 card */
  sqFs: number;
  line: string;
  /** footer; a 🔥 is drawn as the flame glyph */
  foot: string;
  /** alt text for the image */
  alt: string;
}

export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

const INK = "#0E0F1A";
const PAPER = "#F4F5FB";
const LIME = "#B8F23A";

/** World fills (tokens/spuzl-tokens.css). OG images cannot read CSS variables, so the hex lives here. */
export const WORLD_HEX: Record<WorldId, string> = {
  logic: "#8B7CFF",
  line: "#2FD3E0",
  shape: "#FF8A3D",
  number: "#FFD23F",
  word: "#3DDC84",
  clue: "#FF6B6B",
  reflex: "#4D8BFF",
  rage: "#FF3B3B",
  board: "#F27ADB",
};

/** Linear mix of two #RRGGBB colours, t = share of `b`. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * Daily card background: ink tinted with the world colour. The design's Crownfall card (#1B1835 with
 * #2E2858 dots) is Logic Lab purple at 10% and 25%; every world uses the same ratios.
 */
export function worldCardColours(world: WorldId): { bg: string; dot: string } {
  if (world === "logic") return { bg: "#1B1835", dot: "#2E2858" }; // exact design values
  const w = WORLD_HEX[world];
  return { bg: mix(INK, w, 0.1), dot: mix(INK, w, 0.25) };
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}

/** "Thu 30 Oct" for a YYYY-MM-DD date (GMT, as Dailies are). */
export function cardDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const wd = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const mon = d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return `${wd} ${d.getUTCDate()} ${mon}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export function streakFoot(streak: number, level?: number): string {
  if (streak > 0) return level ? `🔥 ${streak} · Lv ${level}` : `🔥 ${plural(streak, "day")}`;
  return level ? `Lv ${level}` : "";
}

export interface DailyCardInput {
  world: WorldId;
  gameName: string;
  number: number;
  scoring: "time" | "score" | "deaths";
  timeMs: number;
  score: number | null;
  hints: number;
  deaths: number;
  /** % of today's players this time beat; null hides the comparison */
  percentile: number | null;
  /** how many players have a result today (comparison needs company) */
  field: number;
  streak: number;
}

export function dailyCard(i: DailyCardInput): CardModel {
  const { bg, dot } = worldCardColours(i.world);
  const effort =
    i.scoring === "deaths"
      ? i.deaths === 0
        ? "No deaths."
        : `${plural(i.deaths, "death")}.`
      : i.hints === 0
        ? "No hints."
        : `${plural(i.hints, "hint")}.`;
  let compare = "";
  if (i.percentile !== null && i.field >= 2)
    compare = i.percentile >= 100 ? " Fastest today." : ` Faster than ${Math.round(i.percentile)}%.`;
  const big = i.scoring === "score" && i.score !== null ? formatNumber(i.score) : formatShort(i.timeMs);
  return {
    kind: "daily",
    bg,
    dot,
    fg: PAPER,
    z: LIME,
    mood: "cheer",
    spuz: LIME,
    kicker: `${i.gameName} #${i.number}`,
    big,
    bigFs: big.length > 5 ? 180 : 220,
    sqFs: big.length > 5 ? 120 : 150,
    line: `${effort}${compare}`,
    foot: streakFoot(i.streak),
    alt: `SPUZL ${i.gameName} #${i.number} cleared in ${formatShort(i.timeMs)}`,
  };
}

export interface FullCardInput {
  date: string;
  cleared: number;
  totalMs: number;
  streak: number;
  level: number;
}

export function fullCard(i: FullCardInput): CardModel {
  return {
    kind: "full",
    bg: LIME,
    dot: "#A3DB2A",
    fg: INK,
    z: INK,
    mood: "party",
    spuz: "#2FD3E0",
    kicker: cardDate(i.date),
    big: "Full Spuzl",
    bigFs: 120,
    sqFs: 80,
    line: `All ${i.cleared} Dailies in ${formatShort(i.totalMs)}`,
    foot: streakFoot(i.streak, i.level),
    alt: `SPUZL Full Spuzl: all ${i.cleared} Dailies cleared`,
  };
}

export interface DuelCardInput {
  gameName: string;
  winnerRounds: number;
  loserRounds: number;
  loser: string;
  ratingAfter: number | null;
  ratingBefore: number | null;
  bestOf: number;
}

export function duelCard(i: DuelCardInput): CardModel {
  const rated = i.ratingAfter !== null && i.ratingBefore !== null;
  const delta = rated ? Math.round(i.ratingAfter! - i.ratingBefore!) : 0;
  return {
    kind: "duel",
    bg: INK,
    dot: "#22253C",
    fg: PAPER,
    z: LIME,
    mood: "proud",
    spuz: LIME,
    kicker: `Duel · ${i.gameName}`,
    big: `${i.winnerRounds} - ${i.loserRounds}`,
    bigFs: 220,
    sqFs: 150,
    line: rated ? `Beat ${i.loser}. Rating ${formatNumber(Math.round(i.ratingAfter!))}.` : `Beat ${i.loser}.`,
    foot: rated ? `${delta >= 0 ? "+" : ""}${delta} rating` : `Best of ${i.bestOf}`,
    alt: `SPUZL Duel win, ${i.winnerRounds} to ${i.loserRounds}`,
  };
}

export interface PartyCardInput {
  players: number;
  place: number;
  winner: string;
  games: number;
  code: string | null;
}

export function partyCard(i: PartyCardInput): CardModel {
  return {
    kind: "party",
    bg: "#FFC93C",
    dot: "#F0B820",
    fg: INK,
    z: INK,
    mood: i.place === 1 ? "party" : i.place <= 3 ? "proud" : "cheer",
    spuz: "#FF8A3D",
    kicker: `Party · ${i.players} Spuzlers`,
    big: ordinal(i.place),
    bigFs: 220,
    sqFs: 150,
    line: `${i.winner} took the room. ${plural(i.games, "game")}.`,
    foot: i.code ? `Room ${i.code}` : "",
    alt: `SPUZL Party: ${ordinal(i.place)} of ${i.players}`,
  };
}

/** Design samples (share card frames), used by the dev preview route and tests. */
export const SAMPLE_CARDS: Record<CardKind, CardModel> = {
  daily: dailyCard({
    world: "logic",
    gameName: "Crownfall",
    number: 214,
    scoring: "time",
    timeMs: 72_000,
    score: null,
    hints: 0,
    deaths: 0,
    percentile: 82,
    field: 40,
    streak: 12,
  }),
  full: fullCard({ date: "2026-10-30", cleared: 15, totalMs: 38 * 60_000 + 12_000, streak: 12, level: 15 }),
  duel: duelCard({ gameName: "Sixer", winnerRounds: 2, loserRounds: 1, loser: "Tunde", ratingAfter: 1438, ratingBefore: 1420, bestOf: 3 }),
  party: partyCard({ players: 5, place: 1, winner: "Kofi", games: 3, code: "K7QX" }),
};

// ---------- Status card (Phase 5, admin setting "features.statusCards") ----------

/** 1080 × 1350 (4:5 portrait): fits feeds and stories without cropping the stats. */
export const STATUS_CARD_SIZE = { width: 1080, height: 1350 } as const;

/** Rank emblem fills (lib/rating/glicko2 RANKS emblems). OG images cannot read CSS variables. */
export const RANK_HEX: Record<string, string> = {
  pebble: "#A2A6C2",
  spark: "#FFC93C",
  gear: "#2FD3E0",
  compass: "#8B7CFF",
  crown: "#FF8A3D",
  prism: "#B8F23A",
};

/** Hats SpuzOG can draw (components/meta/SpuzWear.tsx); anything else is dropped. */
export const STATUS_HATS = ["party", "crown", "kente", "shades", "headphones", "chef", "beanie"] as const;

export interface StatusCardInput {
  nickname: string;
  /** avatar colour, #RRGGBB */
  color: string;
  hat: string | null;
  level: number;
  streak: number;
  /** world with the most clears; null when the player has no clears yet */
  favouriteWorld: WorldId | null;
  gamesTried: number;
  totalGames: number;
  rank: { name: string; division: string; emblem: string } | null;
  /** age band 13-15: public cards show nickname and avatar only, so no level or rank */
  minor: boolean;
  /** "Hide my activity": no streak and no favourite world */
  hideActivity: boolean;
}

export interface StatusStat {
  id: "level" | "streak" | "tried" | "world";
  label: string;
  value: string;
}

export interface StatusCardModel {
  kind: "status";
  bg: string;
  dot: string;
  fg: string;
  z: string;
  spuz: string;
  hat: string | null;
  mood: SpuzMood;
  nickname: string;
  kicker: string;
  stats: StatusStat[];
  /** world fill for the favourite-world chip, when shown */
  worldHex: string | null;
  rank: { label: string; color: string } | null;
  alt: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Favourite world: the most clears, ties broken by world order. Null with no clears. */
export function favouriteWorld(stats: { game: string; clears: number }[]): WorldId | null {
  const by = new Map<WorldId, number>();
  for (const s of stats) {
    const w = GAME_BY_ID[s.game]?.world;
    if (w && s.clears > 0) by.set(w, (by.get(w) ?? 0) + s.clears);
  }
  let best: WorldId | null = null;
  for (const w of WORLDS) if ((by.get(w.id) ?? 0) > (best ? by.get(best)! : 0)) best = w.id;
  return best;
}

/**
 * The player's status card. Pure: the loader fills the input from database rows. Privacy rules live here so
 * the image and the share text agree: nickname only (never city, school, email or age), no level or rank for
 * under-16s, no streak or favourite world while activity is hidden.
 */
export function statusCard(i: StatusCardInput): StatusCardModel {
  const world = !i.hideActivity && i.favouriteWorld && WORLD_BY_ID[i.favouriteWorld] ? i.favouriteWorld : null;
  const { bg, dot } = world ? worldCardColours(world) : { bg: INK, dot: "#22253C" };
  const streak = i.hideActivity ? null : Math.max(0, Math.floor(i.streak));
  const stats: StatusStat[] = [];
  if (!i.minor) stats.push({ id: "level", label: "Level", value: `Lv ${formatNumber(Math.max(1, Math.floor(i.level)))}` });
  if (streak !== null) stats.push({ id: "streak", label: "Streak", value: streak > 0 ? `🔥 ${plural(streak, "day")}` : "Fresh start" });
  const total = Math.max(1, i.totalGames);
  const tried = Math.min(total, Math.max(0, Math.floor(i.gamesTried)));
  stats.push({ id: "tried", label: "Games tried", value: `${formatNumber(tried)} of ${formatNumber(total)}` });
  if (world) stats.push({ id: "world", label: "Favourite world", value: WORLD_BY_ID[world].name });
  const rank =
    !i.minor && i.rank
      ? { label: `${i.rank.name}${i.rank.division ? ` ${i.rank.division}` : ""}`, color: RANK_HEX[i.rank.emblem] ?? RANK_HEX.pebble }
      : null;
  const hat = i.hat && (STATUS_HATS as readonly string[]).includes(i.hat) ? i.hat : null;
  const spoken = stats.map((s) => `${s.label} ${s.value.replace("🔥 ", "")}`);
  return {
    kind: "status",
    bg,
    dot,
    fg: PAPER,
    z: LIME,
    spuz: HEX.test(i.color) ? i.color.toUpperCase() : LIME,
    hat,
    // The fire pose draws a flame where a hat sits, and proud scales the body under it: with a hat, Spuz waves.
    mood: hat ? "wave" : streak !== null && streak >= 7 ? "fire" : "proud",
    nickname: i.nickname,
    kicker: "My SPUZL status",
    stats,
    worldHex: world ? WORLD_HEX[world] : null,
    rank,
    alt: `${i.nickname}'s SPUZL status: ${[rank ? `Rank ${rank.label}` : null, ...spoken].filter(Boolean).join(", ")}`,
  };
}

/** Design sample for the dev preview route and tests. */
export const SAMPLE_STATUS: StatusCardModel = statusCard({
  nickname: "Kofi",
  color: "#2FD3E0",
  hat: "kente",
  level: 15,
  streak: 12,
  favouriteWorld: "logic",
  gamesTried: 23,
  totalGames: 51,
  rank: { name: "Solver", division: "II", emblem: "gear" },
  minor: false,
  hideActivity: false,
});
