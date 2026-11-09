import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPage } from "./paging";
import type { PageParams } from "./pagination";
import { feedbackForConsole, type FeedbackDbRow, type FeedbackFilters, type FeedbackRow } from "./feedback";

const COLS = "id, created_at, status, kind, message, email, age_band, from_path, user_agent, player_id, handled_at";

function build(db: SupabaseClient, f: FeedbackFilters) {
  return () => {
    let q = db.from("feedback").select(COLS, { count: "exact" }).order("created_at", { ascending: false }).order("id");
    if (f.status) q = q.eq("status", f.status);
    if (f.kind) q = q.eq("kind", f.kind);
    return q;
  };
}

async function forConsole(db: SupabaseClient, rows: FeedbackDbRow[], pii: boolean): Promise<FeedbackRow[]> {
  const ids = [...new Set(rows.map((r) => r.player_id).filter((x): x is string => !!x))];
  const { data } = ids.length ? await db.from("players").select("id, nickname").in("id", ids) : { data: [] };
  const name = new Map((data ?? []).map((p) => [p.id as string, p.nickname as string]));
  return rows.map((r) => feedbackForConsole(r, r.player_id ? (name.get(r.player_id) ?? null) : null, pii));
}

/** One page of feedback, newest first. */
export async function feedbackPage(db: SupabaseClient, f: FeedbackFilters, p: PageParams, pii: boolean) {
  const { rows, total } = await fetchPage(build(db, f), p);
  return { rows: await forConsole(db, rows as FeedbackDbRow[], pii), total };
}

/** Every matching message up to `max`, newest first, for the CSV export. */
export async function feedbackAll(db: SupabaseClient, f: FeedbackFilters, max: number, pii: boolean) {
  const { data, error, count } = await build(db, f)().range(0, max - 1);
  if (error) throw error;
  return { rows: await forConsole(db, (data ?? []) as FeedbackDbRow[], pii), total: count ?? 0 };
}

/** Messages still marked new (the Overview tile); null when the table isn't there yet (migration not applied). */
export async function newFeedbackCount(db: SupabaseClient): Promise<number | null> {
  const { count, error } = await db.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new");
  return error ? null : (count ?? 0);
}
