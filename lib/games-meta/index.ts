/**
 * Library metadata per game (SPZ-14): typical play time for the duration chip, and the filter tags.
 * These are the defaults; the admin console can override them per game (games.typical_sec and games.tags),
 * read at runtime through useGamesMeta().
 */
import { GAMES, LAB_GAMES } from "@/lib/catalog";
import { isRaceGame } from "@/lib/multiplayer/games";

export const TAGS = ["quick", "calm", "competitive"] as const;
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
};

/** Games with a clock pushing you (reaction, action, countdowns) are never "calm". */
const PRESSURE = new Set(["merge", "quickfire", "flagged", "deadon", "seven"]);

export function defaultTags(id: string): Tag[] {
  const g = [...GAMES, ...LAB_GAMES].find((x) => x.id === id);
  if (!g) return [];
  const tags: Tag[] = [];
  if ((TYPICAL_SEC[id] ?? 180) < 120) tags.push("quick");
  if (g.world !== "reflex" && g.world !== "rage" && !PRESSURE.has(id)) tags.push("calm");
  if (isRaceGame(id) || g.botPlay) tags.push("competitive");
  return tags;
}

export type GameMetaRow = { typicalSec: number; tags: Tag[] };

export const DEFAULT_META: Record<string, GameMetaRow> = Object.fromEntries(
  [...GAMES, ...LAB_GAMES].map((g) => [g.id, { typicalSec: TYPICAL_SEC[g.id] ?? 180, tags: defaultTags(g.id) }]),
);

/** "About 2 min" style label; under a minute shows "Under 1 min". */
export function durationLabel(sec: number): string {
  if (sec < 60) return "Under 1 min";
  return `${Math.round(sec / 60)} min`;
}

export const isTag = (t: unknown): t is Tag => typeof t === "string" && (TAGS as readonly string[]).includes(t);

/** Validates an admin override; returns an error message or null. */
export function validateMeta(m: { typicalSec?: unknown; tags?: unknown }): string | null {
  if (
    m.typicalSec !== undefined &&
    (typeof m.typicalSec !== "number" || !Number.isInteger(m.typicalSec) || m.typicalSec < 10 || m.typicalSec > 3600)
  )
    return "Typical time must be a whole number of seconds between 10 and 3600";
  if (m.tags !== undefined && (!Array.isArray(m.tags) || !m.tags.every(isTag) || new Set(m.tags).size !== m.tags.length))
    return `Tags must be distinct values from: ${TAGS.join(", ")}`;
  return null;
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
