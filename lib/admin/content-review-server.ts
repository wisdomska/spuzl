import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLogic } from "@/games/logic-registry";
import { liveContent, setContentReview, withContentReview, type ContentReview } from "@/games/_shared/live";
import type { Difficulty } from "@/games/types";
import { createRng } from "@/lib/rng";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AdminCtx } from "./auth";
import { entryHash, FILES } from "./content-files";
import { isContentGame, type ContentGame } from "./content-schemas";
import { canonical, MIN_LIVE_ENTRIES, reviewFrom, stateOf, type EntryState, type ReviewRow } from "./content-review";

/** A content.ts entry with its review (round 3, item 12). */
export interface ReviewEntry {
  index: number;
  ref: string;
  hash: string;
  entry: unknown;
  state: EntryState;
  /** the corrected entry players get, for state "edited" */
  edit?: unknown;
  notes: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  /** the content_items row id, when there is one */
  row_id: string | null;
}

interface StoredRow {
  id: string;
  source_ref: string;
  source_hash: string | null;
  status: string;
  payload: unknown;
  notes: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
}

/** Every entry of a game's content.ts with its current review, in file order, plus the code's needsReview flag. */
export async function reviewEntries(db: SupabaseClient, game: ContentGame): Promise<{ codeFlag: boolean; entries: ReviewEntry[] }> {
  const f = await FILES[game]();
  const { data, error } = await db
    .from("content_items")
    .select("id, source_ref, source_hash, status, payload, notes, reviewer_id, reviewed_at")
    .eq("source", "content_file")
    .eq("game_id", game);
  if (error) throw error;
  const byRef = new Map(((data ?? []) as StoredRow[]).map((r) => [r.source_ref, r]));
  const entries = f.entries.map((entry, index): ReviewEntry => {
    const ref = `${game}:${index}`;
    const hash = entryHash(entry);
    const r = byRef.get(ref);
    const row: ReviewRow | undefined = r && {
      source_ref: r.source_ref,
      source_hash: r.source_hash,
      status: r.status,
      // jsonb reorders keys, so compare canonical JSON, not hashes of the stored text
      edited: r.payload !== undefined && r.payload !== null && canonical(r.payload) !== canonical(entry),
    };
    const state = stateOf(row, hash);
    return {
      index,
      ref,
      hash,
      entry,
      state,
      ...(state === "edited" && { edit: r!.payload }),
      notes: r?.notes ?? null,
      reviewer_id: r?.reviewer_id ?? null,
      reviewed_at: r?.reviewed_at ?? null,
      row_id: r?.id ?? null,
    };
  });
  return { codeFlag: f.needsReview, entries };
}

/* ---------- serving: what boards may deal ---------- */

const TTL_MS = 30_000;
const synced = new Map<string, number>();

/**
 * Before the server builds a board for a content game: loads the game's reviewed state from the database (30 s per
 * server instance) into games/_shared/live.ts, so its picker leaves retired entries out and deals edited ones. If the
 * database can't be read, the last state read stays in place.
 */
export async function syncContentReview(game: string, db: SupabaseClient = supabaseAdmin()): Promise<void> {
  if (!isContentGame(game)) return;
  const at = synced.get(game);
  if (at && Date.now() - at < TTL_MS) return;
  try {
    const { entries } = await reviewEntries(db, game);
    setContentReview(game, reviewFrom(entries));
    synced.set(game, Date.now());
  } catch {
    // keep the last state; try again on the next board
  }
}

/** After a review decision: this instance reads the game's state again on its next board (others within 30 s). */
export function forgetContentReview(game: string) {
  synced.delete(game);
}

/* ---------- the check before a decision is saved ---------- */

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert"];
type Board = { puzzle: unknown; solution: unknown };
type Logic = { generate(rng: ReturnType<typeof createRng>, d: Difficulty): Board; generateAt?(i: number, d: Difficulty): Board };

const roundsOf = (b: Board) => {
  const r = (b.puzzle as { rounds?: unknown[] } | null)?.rounds;
  return Array.isArray(r) ? r.length : null;
};

/**
 * True when the game still deals full boards with `review` in place: at least MIN_LIVE_ENTRIES entries stay in play,
 * and Daily and free-play boards across difficulties build without error and with as many rounds as before. With
 * `sweep`, every Daily index (up to a time budget) is built too, so an edited entry is dealt at least once.
 */
export async function stillPlayable(game: ContentGame, review: ContentReview, sweep = false): Promise<boolean> {
  const all = (await FILES[game]()).entries;
  const logic = (await loadLogic(game)) as unknown as Logic;
  const boards = (): Board[] => {
    const out: Board[] = [];
    for (let s = 0; s < 4; s++) for (const d of DIFFS) out.push(logic.generate(createRng(`review-check:${game}:${s}`), d));
    if (logic.generateAt) for (let i = 0; i < 8; i++) out.push(logic.generateAt(i, DIFFS[i % DIFFS.length]));
    return out;
  };
  try {
    const before = withContentReview(game, null, boards).map(roundsOf);
    return withContentReview(game, review, () => {
      if (liveContent(game, all).length < Math.min(MIN_LIVE_ENTRIES, all.length)) return false;
      const after = boards();
      if (after.some((b, k) => (roundsOf(b) ?? 0) < (before[k] ?? 0))) return false;
      if (sweep && logic.generateAt) {
        const end = Date.now() + 3000;
        const n = Math.max(liveContent(game, all).length, 60);
        for (let i = 0; i < n && Date.now() < end; i++) logic.generateAt(i, DIFFS[i % DIFFS.length]);
      }
      return true;
    });
  } catch {
    return false;
  }
}

/* ---------- saving a decision ---------- */

/** Saves one entry's decision: the current row in content_items and a line in content_reviews (history). */
export async function saveDecision(
  ctx: Pick<AdminCtx, "db" | "user">,
  game: ContentGame,
  e: ReviewEntry,
  decision: "approve" | "edit" | "retire",
  payload: unknown,
  notes: string | null,
  now: string,
) {
  const row = {
    game_id: game,
    payload,
    source: "content_file",
    source_ref: e.ref,
    source_hash: e.hash,
    status: decision === "retire" ? "retired" : "approved",
    reviewer_id: ctx.user.id,
    reviewed_at: now,
    updated_at: now,
    needs_owner_review: false,
    notes,
  };
  const { error } = e.row_id
    ? await ctx.db.from("content_items").update(row).eq("id", e.row_id)
    : await ctx.db.from("content_items").insert(row);
  if (error) throw error;
  const { error: e2 } = await ctx.db.from("content_reviews").insert({
    game_id: game,
    source_ref: e.ref,
    source_hash: e.hash,
    decision: decision === "approve" && e.state === "retired" ? "restore" : decision,
    payload: decision === "edit" ? payload : null,
    notes,
    reviewer_id: ctx.user.id,
  });
  if (e2) throw e2;
}
