/**
 * Content review queue (round 3, item 12): the state of each content.ts entry from its review row, and what a game's
 * boards may deal. Pure: the admin routes, the serving sync (./content-review-server.ts) and the tests share it.
 *
 * A review applies while the entry is unchanged in code (its hash matches the row's): approved (dealt as written),
 * edited (dealt as the reviewer corrected it) or retired (never dealt). An entry changed in code since its review is
 * "changed" and goes back in the queue, dealt as written until reviewed again. A game's needsReview flag clears once
 * every entry is reviewed: derived here from the database, never edited in code.
 */
import type { ContentReview } from "@/games/_shared/live";

export type EntryState = "pending" | "approved" | "edited" | "retired" | "changed";

/** The current review row of an entry (public.content_items, source 'content_file'). */
export interface ReviewRow {
  source_ref: string;
  source_hash: string | null;
  status: string;
  /** true when the stored payload differs from the code entry (an edit) */
  edited: boolean;
}

export function stateOf(r: ReviewRow | undefined, hash: string): EntryState {
  if (!r) return "pending";
  if (r.source_hash !== hash) return "changed";
  // "rejected" is how the owner's earlier review said "retire" (migration 20261207001201 renames it).
  if (r.status === "retired" || r.status === "rejected") return "retired";
  if (r.status === "approved") return r.edited ? "edited" : "approved";
  return "pending";
}

export const isReviewed = (s: EntryState) => s === "approved" || s === "edited" || s === "retired";
export const isTodo = (s: EntryState) => s === "pending" || s === "changed";

export interface ReviewedEntry {
  index: number;
  state: EntryState;
  /** the edited entry, for state "edited" */
  edit?: unknown;
}

/** What boards may deal: retired indexes left out, edited ones swapped in (games/_shared/live.ts). */
export function reviewFrom(entries: readonly ReviewedEntry[]): ContentReview {
  const retired = new Set<number>();
  const edited = new Map<number, unknown>();
  for (const e of entries) {
    if (e.state === "retired") retired.add(e.index);
    else if (e.state === "edited" && e.edit !== undefined) edited.set(e.index, e.edit);
  }
  return { retired, edited };
}

export interface ReviewSummary {
  total: number;
  reviewed: number;
  approved: number;
  edited: number;
  retired: number;
  changed: number;
  pending: number;
  /** the code flag says this content needs review and some entry is not reviewed yet */
  needsReview: boolean;
}

export function summarise(states: readonly EntryState[], codeFlag: boolean): ReviewSummary {
  const n = (s: EntryState) => states.filter((x) => x === s).length;
  const reviewed = states.filter(isReviewed).length;
  return {
    total: states.length,
    reviewed,
    approved: n("approved"),
    edited: n("edited"),
    retired: n("retired"),
    changed: n("changed"),
    pending: n("pending"),
    needsReview: codeFlag && reviewed < states.length,
  };
}

export const REVIEW_SHOW = ["todo", "all", "approved", "edited", "retired"] as const;
export type ReviewShow = (typeof REVIEW_SHOW)[number];

/** Entries matching a filter (to do = pending or changed) and a search over the entry's text. */
export function filterEntries<T extends { state: EntryState; entry: unknown; edit?: unknown }>(
  entries: readonly T[],
  show: ReviewShow,
  q = "",
): T[] {
  const k = q.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (show === "all" ? true : show === "todo" ? isTodo(e.state) : e.state === show) &&
      (!k ||
        JSON.stringify(e.edit ?? e.entry)
          .toLowerCase()
          .includes(k)),
  );
}

/** JSON with object keys sorted, so an entry read back from jsonb (which reorders keys) compares equal to the code's. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v) ?? "null";
}

/** The fewest entries a game keeps in play: retiring stops here (the boards also have to build, checked on save). */
export const MIN_LIVE_ENTRIES = 10;

/**
 * An edited entry as stored: the reviewer's JSON with the schema's tidied fields on top, so fields the schema doesn't
 * list (ids, flag drawings) stay as the reviewer left them. A bare value (Five's word) is the tidied value.
 */
export function editedEntry(raw: unknown, tidied: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && tidied && typeof tidied === "object")
    return { ...(raw as object), ...(tidied as object) };
  return tidied;
}
