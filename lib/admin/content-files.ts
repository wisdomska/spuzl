import "server-only";
import { createHash } from "node:crypto";
import type { Difficulty, Generated } from "@/games/types";
import { rotation } from "@/games/_shared/cluecave";
import { ApiError } from "@/lib/api/server";
import { logicFor } from "./puzzles";
import { SCHEDULABLE, type ContentGame } from "./content-schemas";

/** The content.ts modules, loaded on demand. Each exports `needsReview` and its entry array. */
const FILES: Record<ContentGame, () => Promise<{ needsReview: boolean; entries: unknown[] }>> = {
  coil: async () => {
    const m = await import("@/games/coil/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  rungs: async () => {
    const m = await import("@/games/rungs/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  quads: async () => {
    const m = await import("@/games/quads/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  minicross: async () => {
    const m = await import("@/games/minicross/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  hunch: async () => {
    const m = await import("@/games/hunch/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  quickfire: async () => {
    const m = await import("@/games/quickfire/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  seven: async () => {
    const m = await import("@/games/seven/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  buried: async () => {
    const m = await import("@/games/buried/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  remix: async () => {
    const m = await import("@/games/remix/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  pinned: async () => {
    const m = await import("@/games/pinned/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  flagged: async () => {
    const m = await import("@/games/flagged/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
  pixl: async () => {
    const m = await import("@/games/pixl/art");
    return { needsReview: m.needsReview, entries: m.ART };
  },
  // Lab content games: the owner reviews them here before "features.newGames" goes on.
  five: async () => {
    const m = await import("@/games/five/content");
    return { needsReview: m.needsReview, entries: m.ANSWERS as unknown[] };
  },
  emojihits: async () => {
    const m = await import("@/games/emojihits/content");
    return { needsReview: m.needsReview, entries: m.CONTENT };
  },
};

export const ITEM_COLS =
  "id, game_id, payload, author_id, reviewer_id, status, notes, created_at, updated_at, submitted_at, reviewed_at, scheduled_for, puzzle_id, source";

export const entryHash = (entry: unknown) => createHash("sha256").update(JSON.stringify(entry)).digest("hex").slice(0, 16);

export interface FileEntry {
  game: ContentGame;
  index: number;
  ref: string;
  hash: string;
  entry: unknown;
}

/** Every entry of every content.ts that still carries `needsReview: true`. */
export async function needsReviewEntries(game?: ContentGame): Promise<{ game: ContentGame; total: number; entries: FileEntry[] }[]> {
  const games = (game ? [game] : (Object.keys(FILES) as ContentGame[])).filter((g) => g in FILES);
  const out = [];
  for (const g of games) {
    const f = await FILES[g]();
    if (!f.needsReview) continue;
    out.push({
      game: g,
      total: f.entries.length,
      entries: f.entries.map((entry, index) => ({ game: g, index, ref: `${g}:${index}`, hash: entryHash(entry), entry })),
    });
  }
  return out;
}

export async function fileEntry(game: ContentGame, index: number): Promise<FileEntry> {
  const f = await FILES[game]();
  const entry = f.entries[index];
  if (entry === undefined) throw new ApiError(404, "entry_not_found");
  return { game, index, ref: `${game}:${index}`, hash: entryHash(entry), entry };
}

/**
 * Builds a Daily from an approved item with the game's own generator: the item takes the slots that
 * generateAt(0) reads, the puzzle is generated, and the module array is restored before returning.
 * generateAt is synchronous, so no other request can observe the swap.
 */
export async function buildFromItem(game: ContentGame, payload: unknown, difficulty: Difficulty): Promise<Generated<unknown, unknown>> {
  const plan = SCHEDULABLE[game];
  if (!plan) throw new ApiError(409, "not_schedulable", "This game's items join the content pool; they are not scheduled one by one.");
  const logic = await logicFor(game);
  if (!logic.generateAt) throw new ApiError(409, "not_schedulable");
  const file = await FILES[game]();
  const arr = file.entries;
  const items = plan.items === 1 ? [payload] : (payload as { items: unknown[] }).items;
  if (!Array.isArray(items) || items.length !== plan.items) throw new ApiError(422, "invalid_payload");
  // Which array slots does generateAt(0) read? Rotation games pick from a seeded permutation; the rest read index 0.
  const slots = game === "hunch" || game === "quickfire" ? rotation(arr.length, plan.items, 0, game) : [0];
  const saved = slots.map((s) => arr[s]);
  try {
    slots.forEach((s, k) => (arr[s] = items[k]));
    return logic.generateAt(0, difficulty);
  } finally {
    slots.forEach((s, k) => (arr[s] = saved[k]));
  }
}
