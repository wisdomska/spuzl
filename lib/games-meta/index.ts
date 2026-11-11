/**
 * Library metadata per game (SPZ-14): typical play time for the duration chip, and the filter tags.
 * These are the defaults; the admin console can override them per game (games.typical_sec and games.tags),
 * read at runtime through useGamesMeta().
 */
import { GAMES, GAME_BY_ID, WORLDS, WORLD_BY_ID, type GameMeta, type WorldId } from "@/lib/catalog";
import { isRaceGame } from "@/lib/multiplayer/games";

/** R2-18: "new" marks recently added games (default from the catalog's `isNew`, admin-editable like the rest). */
export const TAGS = ["quick", "calm", "competitive", "new"] as const;
export type Tag = (typeof TAGS)[number];

/** Typical seconds for an average player on the Daily's usual difficulty. */
export const TYPICAL_SEC: Record<string, number> = {
  chess: 150,
  draughts: 150,
  flip: 120,
  fourup: 60,
  ludo: 150,
  oware: 120,
  flagged: 75,
  hunch: 120,
  pinned: 120,
  quickfire: 75,
  flowline: 120,
  isles: 180,
  lost: 120,
  pairup: 60,
  weave: 120,
  blackout: 120,
  crownfall: 110,
  dusk: 120,
  nine: 360,
  pixl: 240,
  sixer: 180,
  tripwire: 180,
  deadon: 90,
  equal: 120,
  merge: 180,
  sums: 180,
  dash: 90,
  flipside: 90,
  gauntlet: 150,
  ghosted: 90,
  gotcha: 90,
  grapple: 90,
  ricochet: 90,
  slip: 90,
  stacked: 90,
  wobble: 90,
  echo: 60,
  flinch: 45,
  twins: 60,
  quilt: 120,
  reflect: 60,
  shuffle: 120,
  snug: 120,
  squint: 60,
  buried: 180,
  coil: 180,
  minicross: 180,
  quads: 120,
  remix: 90,
  rungs: 180,
  seven: 180,
  penalty: 60,
  beattap: 45,
  hilo: 75,
  market: 150,
  five: 150,
  emojihits: 120,
  trotro: 120,
  lightup: 180,
  killer: 300,
  dara: 90,
  twotruths: 120,
};

/**
 * Owner decision S (R4): a score game's typical score on the Daily Five's difficulty, its "par" in Daily Five points
 * (lib/daily-five fivePoints: half the bonus at this score, the full bonus at twice it). Admin-overridable per game
 * (games.typical_score, Library page). A score game without one is scored on time like the rest.
 */
export const TYPICAL_SCORE: Record<string, number> = {
  quickfire: 400, // 5 questions, 100-150 each when right
  emojihits: 350, // 5 rounds, 40-150 each when found
  twotruths: 400, // 5 rounds, 100-150 each when right
  flagged: 800, // 10 rounds, 100-150 each when right
  echo: 8, // the longest sequence repeated
  beattap: 3000, // 16 beats on easy, 300 perfect or 100 good
  flinch: 3000, // 5 rounds, 1000 less the reaction in ms
  twins: 550, // 1000 for a flawless run, less with every extra flip
  penalty: 3000, // 1000 a goal plus up to 100 accuracy, 5 kicks
  hilo: 6, // right calls out of 10
  pinned: 2500, // 5 pins, up to 1000 each, fading with the distance
};

/** The highest typical score the admin can set. */
export const TYPICAL_SCORE_MAX = 1_000_000;

/** Games with a clock pushing you (reaction, action, countdowns) are never "calm". */
const PRESSURE = new Set(["merge", "quickfire", "flagged", "deadon", "seven", "twotruths"]);

export function defaultTags(id: string): Tag[] {
  const g = GAME_BY_ID[id];
  if (!g) return [];
  const tags: Tag[] = [];
  if ((TYPICAL_SEC[id] ?? 180) < 120) tags.push("quick");
  // Arcade (memory, reflex and the action courses, wherever they sit) is never calm.
  if (g.world !== "reflex" && g.engine !== "phaser" && !PRESSURE.has(id)) tags.push("calm");
  if (isRaceGame(id) || g.botPlay) tags.push("competitive");
  if (g.isNew) tags.push("new");
  return tags;
}

/**
 * One game's Library metadata. `rule` and `blurb` are present only when the admin overrode the catalog's copy
 * (games.rule, games.blurb); readers fall back to the catalog through `gameCopy()`.
 */
export type GameMetaRow = { typicalSec: number; tags: Tag[]; rule?: string; blurb?: string; typicalScore?: number };

/** The default row for any game in code (retired ones too, for the admin Library list). */
export const defaultMetaFor = (id: string): GameMetaRow => ({
  typicalSec: TYPICAL_SEC[id] ?? 180,
  tags: defaultTags(id),
  ...(TYPICAL_SCORE[id] && GAME_BY_ID[id]?.scoring === "score" ? { typicalScore: TYPICAL_SCORE[id] } : {}),
});

/** Defaults for the games players can reach (live and lab). Retired games are left out. */
export const DEFAULT_META: Record<string, GameMetaRow> = Object.fromEntries(GAMES.map((g) => [g.id, defaultMetaFor(g.id)]));

/** "About 2 min" style label; under a minute shows "Under 1 min". */
export function durationLabel(sec: number): string {
  if (sec < 60) return "Under 1 min";
  return `${Math.round(sec / 60)} min`;
}

/** R2-18: the games in `games` tagged "new" (admin overrides included), in list order. */
export function newGameIds(games: readonly Pick<GameMeta, "id">[], meta: Record<string, GameMetaRow | undefined>): string[] {
  return games.filter((g) => meta[g.id]?.tags.includes("new")).map((g) => g.id);
}

/** A Library filter from a URL (`/library?filter=new`): All, a tag, or a live world; anything else is All. */
export function parseFilter(v: string | null | undefined): GameFilter {
  if (!v) return "all";
  if (isTag(v)) return v;
  return WORLDS.some((w) => w.id === v) ? (v as WorldId) : "all";
}

export const isTag = (t: unknown): t is Tag => typeof t === "string" && (TAGS as readonly string[]).includes(t);

/** Validates an admin override; returns an error message or null. */
export function validateMeta(m: {
  typicalSec?: unknown;
  tags?: unknown;
  rule?: unknown;
  blurb?: unknown;
  typicalScore?: unknown;
}): string | null {
  if (
    m.typicalSec !== undefined &&
    (typeof m.typicalSec !== "number" || !Number.isInteger(m.typicalSec) || m.typicalSec < 10 || m.typicalSec > 3600)
  )
    return "Typical time must be a whole number of seconds between 10 and 3600";
  if (
    m.typicalScore !== undefined &&
    (typeof m.typicalScore !== "number" || !Number.isInteger(m.typicalScore) || m.typicalScore < 1 || m.typicalScore > TYPICAL_SCORE_MAX)
  )
    return `Typical score must be a whole number between 1 and ${TYPICAL_SCORE_MAX}`;
  if (m.tags !== undefined && (!Array.isArray(m.tags) || !m.tags.every(isTag) || new Set(m.tags).size !== m.tags.length))
    return `Tags must be distinct values from: ${TAGS.join(", ")}`;
  if (m.rule !== undefined) {
    const e = validateCopyLine(m.rule, "The rule");
    if (e) return e;
  }
  if (m.blurb !== undefined) {
    const e = validateCopyLine(m.blurb, "The card copy");
    if (e) return e;
  }
  return null;
}

/** Longest one-line rule or card copy: two lines under the title on a 375 px phone (R2-06). */
export const COPY_MAX = 130;

/** Validates one line of admin copy (a rule or a blurb); returns an error message or null. */
export function validateCopyLine(v: unknown, what: string): string | null {
  if (typeof v !== "string") return `${what} must be text`;
  if (/[\r\n]/.test(v)) return `${what} must be one line`;
  const t = v.trim();
  if (!t) return `${what} cannot be empty (reset it to use the default)`;
  if (t !== v) return `${what} cannot start or end with spaces`;
  if (t.length > COPY_MAX) return `${what} must be at most ${COPY_MAX} characters (now ${t.length})`;
  return null;
}

/**
 * The rule and card copy a player sees: the admin override, else the catalog's. A screen that shows its own copy
 * instead of the catalog's (the bot screen's full-game rule) keeps it: an override replaces only the catalog text.
 */
export function gameCopy(g: Pick<GameMeta, "id" | "rule" | "blurb">, meta: Record<string, GameMetaRow | undefined>) {
  const m = meta[g.id];
  const base = GAME_BY_ID[g.id];
  return {
    rule: m?.rule !== undefined && (!base || g.rule === base.rule) ? m.rule : g.rule,
    blurb: m?.blurb !== undefined && (!base || g.blurb === base.blurb) ? m.blurb : g.blurb,
  };
}

/** Library search: name, world name, blurb; case and accent insensitive. */
export function matchesQuery(text: string, q: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const words = norm(q).split(/\s+/).filter(Boolean);
  const t = norm(text);
  return words.every((w) => t.includes(w));
}

/** One Library filter chip: All, a tag, or a world. Shared by All games and the Duel game picker. */
export type GameFilter = "all" | Tag | WorldId;

/** The Library's filter and search over a list of games (the same rule wherever the filters appear). */
export function filterGames<G extends Pick<GameMeta, "id" | "name" | "world" | "blurb">>(
  games: readonly G[],
  filter: GameFilter,
  q: string,
  meta: Record<string, GameMetaRow | undefined>,
): G[] {
  return games.filter((g) => {
    if (filter !== "all") {
      if (isTag(filter)) {
        if (!meta[g.id]?.tags.includes(filter)) return false;
      } else if (g.world !== filter) return false;
    }
    return !q || matchesQuery(`${g.name} ${WORLD_BY_ID[g.world].name} ${meta[g.id]?.blurb ?? g.blurb}`, q);
  });
}
