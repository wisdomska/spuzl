import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { isUnder16 } from "./index";

/** Public player card fields (SRS 11). Under-16s expose nickname and avatar only. */
export interface Card {
  id: string;
  nickname: string;
  color: string;
  skin: string | null;
  hat: string | null;
  title: string | null;
  level: number | null;
  minor: boolean;
}

const CARD_COLS = "id, nickname, avatar_color, skin, hat, title, level, age_band";

type CardRow = {
  id: string;
  nickname: string;
  avatar_color: string;
  skin: string | null;
  hat: string | null;
  title: string | null;
  level: number;
  age_band: string;
};

export function toCard(r: CardRow): Card {
  const minor = isUnder16(r.age_band);
  return {
    id: r.id,
    nickname: r.nickname,
    color: r.avatar_color,
    skin: r.skin,
    hat: r.hat,
    title: minor ? null : r.title,
    level: minor ? null : r.level,
    minor,
  };
}

/** Cards for a set of ids (banned and test players excluded). */
export async function cards(admin: SupabaseClient, ids: string[]): Promise<Map<string, Card & { raw: CardRow & Extra }>> {
  const out = new Map<string, Card & { raw: CardRow & Extra }>();
  if (!ids.length) return out;
  const { data, error } = await admin
    .from("players")
    .select(`${CARD_COLS}, last_seen_at, playing_game, hide_activity`)
    .in("id", [...new Set(ids)])
    .is("banned_at", null);
  if (error) throw error;
  for (const r of (data ?? []) as (CardRow & Extra)[]) out.set(r.id, { ...toCard(r), raw: r });
  return out;
}
interface Extra {
  last_seen_at: string | null;
  playing_game: string | null;
  hide_activity: boolean;
}

export async function friendIds(admin: SupabaseClient, playerId: string): Promise<string[]> {
  const { data, error } = await admin.rpc("svc_friend_ids", { p: playerId });
  if (error) throw error;
  return (data ?? []).map((r: string | { svc_friend_ids: string }) => (typeof r === "string" ? r : r.svc_friend_ids));
}

/** Ids this player blocked or was blocked by. */
export async function blockedIds(admin: SupabaseClient, playerId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from("blocks")
    .select("player_id, blocked_id")
    .or(`player_id.eq.${playerId},blocked_id.eq.${playerId}`);
  if (error) throw error;
  return new Set((data ?? []).map((b) => (b.player_id === playerId ? b.blocked_id : b.player_id)));
}

export async function isBlockedPair(admin: SupabaseClient, a: string, b: string): Promise<boolean> {
  return (await blockedIds(admin, a)).has(b);
}

export async function friendshipBetween(admin: SupabaseClient, a: string, b: string) {
  const { data, error } = await admin
    .from("friendships")
    .select("player_id, friend_id, status, created_at")
    .or(`and(player_id.eq.${a},friend_id.eq.${b}),and(player_id.eq.${b},friend_id.eq.${a})`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Makes two players friends (accepted). Used by invite links, where both sides consented. */
export async function befriend(admin: SupabaseClient, a: string, b: string) {
  if (a === b) throw new ApiError(400, "self", "That's your own invite.");
  if (await isBlockedPair(admin, a, b)) throw new ApiError(403, "blocked", "You can't add this player.");
  const existing = await friendshipBetween(admin, a, b);
  if (existing) {
    if (existing.status !== "accepted")
      await admin.from("friendships").update({ status: "accepted" }).eq("player_id", existing.player_id).eq("friend_id", existing.friend_id);
    return;
  }
  const { error } = await admin.from("friendships").insert({ player_id: a, friend_id: b, status: "accepted" });
  if (error && error.code !== "23505") throw error;
}

/** Postgres raise messages from svc_* functions arrive in error.message. */
export function sqlMessage(e: { message?: string } | null): string {
  return e?.message ?? "";
}

/** Blocks a player and ends any friendship or request between you. */
export async function blockPlayer(admin: SupabaseClient, me: string, other: string) {
  const { error } = await admin.from("blocks").upsert({ player_id: me, blocked_id: other }, { onConflict: "player_id,blocked_id", ignoreDuplicates: true });
  if (error?.code === "23503") throw new ApiError(404, "not_found");
  if (error) throw error;
  const { error: e2 } = await admin
    .from("friendships")
    .delete()
    .or(`and(player_id.eq.${me},friend_id.eq.${other}),and(player_id.eq.${other},friend_id.eq.${me})`);
  if (e2) throw e2;
}
