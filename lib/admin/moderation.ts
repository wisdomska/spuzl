import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_BY_ID } from "@/lib/catalog";
import { clock } from "./dates";

/** Short display id, e.g. R-3F2A for reports, F-91BC for flagged scores. */
export const shortRef = (prefix: string, id: string) => `${prefix}-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;

const KIND: Record<string, string> = { player: "Player", nickname: "Nickname", crew: "Crew", score: "Anti-cheat", content: "Content" };
const REASON: Record<string, string> = {
  nickname: "Nickname",
  cheating: "Cheating",
  harassment: "Harassment",
  spam: "Spam",
  other: "Other",
};

export interface ModRow {
  id: string;
  ref: string;
  title: string;
  kind: string;
  status: string;
  created_at: string;
  player_id: string | null;
}

export interface PlayerSummary {
  id: string;
  nickname: string;
  created_at: string;
  banned_at: string | null;
  banned_until: string | null;
  ban_reason: string | null;
  ranking_revoked: boolean;
  is_test: boolean;
  reports: number;
  flagged: number;
}

export async function playerSummaries(db: SupabaseClient, ids: string[]): Promise<Record<string, PlayerSummary>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {};
  const [{ data: players }, { data: reports }, { data: flags }] = await Promise.all([
    db.from("players").select("id, nickname, created_at, banned_at, banned_until, ban_reason, ranking_revoked, is_test").in("id", uniq),
    db.from("reports").select("target_id").in("target_type", ["player", "nickname"]).in("target_id", uniq),
    db.from("attempts").select("player_id").in("player_id", uniq).in("status", ["flagged"]),
  ]);
  const count = (rows: { [k: string]: string }[] | null, key: string, id: string) => (rows ?? []).filter((r) => r[key] === id).length;
  return Object.fromEntries(
    (players ?? []).map((p) => [
      p.id,
      {
        ...p,
        nickname: String(p.nickname),
        reports: count(reports, "target_id", p.id),
        flagged: count(flags, "player_id", p.id),
      } as PlayerSummary,
    ]),
  );
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function reportRows(db: SupabaseClient, tab: "reports" | "nicknames", status: string): Promise<ModRow[]> {
  let q = db
    .from("reports")
    .select("id, reporter_id, target_type, target_id, reason, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  q = tab === "nicknames" ? q.or("target_type.eq.nickname,reason.eq.nickname") : q.neq("target_type", "nickname").neq("reason", "nickname");
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const players = await playerSummaries(
    db,
    rows.filter((r) => ["player", "nickname"].includes(r.target_type) && UUID.test(r.target_id)).map((r) => r.target_id),
  );
  return rows.map((r) => {
    const p = players[r.target_id];
    const who = p?.nickname ?? r.target_id.slice(0, 8);
    const title =
      r.target_type === "nickname" || r.reason === "nickname"
        ? `Nickname "${who}" reported`
        : r.target_type === "player"
          ? `${who} · ${REASON[r.reason] ?? r.reason}`
          : `${KIND[r.target_type] ?? r.target_type} ${r.target_id.slice(0, 12)} · ${REASON[r.reason] ?? r.reason}`;
    return {
      id: r.id,
      ref: shortRef("R", r.id),
      title,
      kind: KIND[r.target_type] ?? r.target_type,
      status: r.status,
      created_at: r.created_at,
      player_id: p ? r.target_id : null,
    };
  });
}

export async function flaggedRows(db: SupabaseClient): Promise<ModRow[]> {
  const { data, error } = await db
    .from("attempts")
    .select("id, player_id, game_id, mode, time_ms, started_at, finished_at")
    .eq("status", "flagged")
    .order("finished_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  const players = await playerSummaries(
    db,
    (data ?? []).map((a) => a.player_id),
  );
  return (data ?? []).map((a) => ({
    id: a.id,
    ref: shortRef("F", a.id),
    title: `${players[a.player_id]?.nickname ?? "player"} · ${GAME_BY_ID[a.game_id]?.name ?? a.game_id} ${clock(a.time_ms)}`,
    kind: "Anti-cheat",
    status: "flagged",
    created_at: a.finished_at ?? a.started_at,
    player_id: a.player_id,
  }));
}

/**
 * Input timing from a stored move log: gaps in ms between consecutive moves. Accepts entries with a
 * `t` / `at` / `ms` timestamp or [t, ...] tuples. Empty when the attempt has no timed log.
 */
export function moveGaps(moves: unknown): number[] {
  if (!Array.isArray(moves)) return [];
  const ts = moves
    .map((m) =>
      Array.isArray(m)
        ? m[0]
        : m && typeof m === "object"
          ? ((m as Record<string, unknown>).t ?? (m as Record<string, unknown>).at ?? (m as Record<string, unknown>).ms)
          : null,
    )
    .map((t) => (typeof t === "string" ? Date.parse(t) : t))
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  const gaps: number[] = [];
  for (let i = 1; i < ts.length; i++) gaps.push(Math.max(0, ts[i] - ts[i - 1]));
  return gaps;
}
