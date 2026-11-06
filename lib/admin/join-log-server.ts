import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./dates";
import { fetchPage } from "./paging";
import type { PageParams } from "./pagination";
import type { JoinLogFilters, JoinLogRow } from "./join-log";

type Raw = Omit<JoinLogRow, "requester" | "host">;
const COLS = "id, created_at, decided_at, status, room_kind, room_code, requester_id, host_id";

/** Player ids whose nickname contains `q` (case-insensitive), for the log's search. */
async function idsMatching(db: SupabaseClient, q: string): Promise<string[]> {
  const { data, error } = await db
    .from("players")
    .select("id")
    .ilike("nickname", `%${q.replace(/_/g, "\\_")}%`)
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((p) => p.id as string);
}

async function build(db: SupabaseClient, f: JoinLogFilters) {
  const ids = f.q ? await idsMatching(db, f.q) : [];
  return () => {
    let q = db.from("room_join_requests").select(COLS, { count: "exact" }).order("created_at", { ascending: false }).order("id");
    if (f.status) q = q.eq("status", f.status);
    if (f.kind) q = q.eq("room_kind", f.kind);
    if (f.from) q = q.gte("created_at", `${f.from}T00:00:00Z`);
    if (f.to) q = q.lt("created_at", `${addDays(f.to, 1)}T00:00:00Z`);
    if (f.q) {
      // q is letters, digits and underscores only (parseJoinLogFilters), so it is safe inside the or() filter.
      const list = ids.length ? `(${ids.join(",")})` : null;
      q = q.or([`room_code.eq.${f.q.toUpperCase()}`, ...(list ? [`requester_id.in.${list}`, `host_id.in.${list}`] : [])].join(","));
    }
    return q;
  };
}

async function withNames(db: SupabaseClient, rows: Raw[]): Promise<JoinLogRow[]> {
  const ids = [...new Set(rows.flatMap((r) => [r.requester_id, r.host_id]))];
  const { data } = ids.length ? await db.from("players").select("id, nickname").in("id", ids) : { data: [] };
  const name = new Map((data ?? []).map((p) => [p.id as string, p.nickname as string]));
  return rows.map((r) => ({ ...r, requester: name.get(r.requester_id) ?? null, host: name.get(r.host_id) ?? null }));
}

/** One page of the join-approval log, newest first. */
export async function joinLogPage(db: SupabaseClient, f: JoinLogFilters, p: PageParams) {
  const { rows, total } = await fetchPage(await build(db, f), p);
  return { rows: await withNames(db, rows as Raw[]), total };
}

/** Every matching row up to `max`, newest first, for the CSV export. */
export async function joinLogAll(db: SupabaseClient, f: JoinLogFilters, max: number) {
  const { data, error, count } = await (await build(db, f))().range(0, max - 1);
  if (error) throw error;
  return { rows: await withNames(db, (data ?? []) as Raw[]), total: count ?? 0 };
}
