import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { EVENT_QUEST_ICON, eventQuestDelta, eventQuestId, type EventRow } from "./index";

export const EVENT_COLS = "id, name, starts_at, ends_at, accent, banner, quest, created_at";

/**
 * The event running now (latest start wins, as `pickActive`), or null. Always null while the admin setting
 * "features.seasonal" is off: every player-facing read goes through here, so the switch is enforced server side.
 */
export async function activeEvent(admin: SupabaseClient, now = new Date()): Promise<EventRow | null> {
  if (!(await getGameSettings())["features.seasonal"]) return null;
  const at = now.toISOString();
  const { data, error } = await admin
    .from("events")
    .select(EVENT_COLS)
    .lte("starts_at", at)
    .gt("ends_at", at)
    .order("starts_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as EventRow | undefined) ?? null;
}

/** Public shape of an event (GET /api/v1/events/current). */
export function publicEvent(e: EventRow) {
  return {
    id: e.id,
    name: e.name,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    accent: e.accent,
    banner: e.banner,
    quest: { id: eventQuestId(e.id), title: e.quest.title, target: e.quest.n, xp: e.quest.xp, sparks: e.quest.sparks },
  };
}

/** The event's bonus quest as a Quests-list entry (same shape as daily and weekly quests, plus event fields). */
export async function eventQuestFor(admin: SupabaseClient, playerId: string, e: EventRow) {
  const { data: row } = await admin
    .from("event_progress")
    .select("progress, completed_at, claimed_at")
    .eq("player_id", playerId)
    .eq("event_id", e.id)
    .maybeSingle();
  return {
    id: eventQuestId(e.id),
    kind: "event" as const,
    step: null,
    title: e.quest.title,
    icon: EVENT_QUEST_ICON[e.quest.kind] ?? "star",
    xp: e.quest.xp,
    sparks: e.quest.sparks,
    progress: Math.min(e.quest.n, row?.progress ?? 0),
    target: e.quest.n,
    completed: !!row?.completed_at,
    claimed: !!row?.claimed_at,
    event: { id: e.id, name: e.name, endsAt: e.ends_at, accent: e.accent },
  };
}

/**
 * Claims a completed event quest's XP and Sparks (POST /api/v1/quests/ev-<id>/claim). Same contract as the other
 * quest claims: idempotent (svc_grant_reward pays once per `event:<id>`), 404 for an unknown event or while
 * "features.seasonal" is off, 409 until the quest is complete. A completed quest stays claimable after the event
 * ends, so a player who finished it at the last minute is still paid.
 */
export async function claimEventQuest(admin: SupabaseClient, player: { id: string; sparks: number }, eventId: string) {
  if (!(await getGameSettings())["features.seasonal"]) throw new ApiError(404, "unknown_quest");
  const { data: e } = await admin.from("events").select(EVENT_COLS).eq("id", eventId).maybeSingle();
  if (!e) throw new ApiError(404, "unknown_quest");
  const ev = e as EventRow;
  const { data: row } = await admin
    .from("event_progress")
    .select("completed_at, claimed_at")
    .eq("player_id", player.id)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!row?.completed_at) throw new ApiError(409, "not_complete", "Finish the quest first.");
  const { data, error } = await admin.rpc("svc_grant_reward", {
    p_player: player.id,
    p_source: "quest",
    p_ref: `event:${eventId}`,
    p_xp: ev.quest.xp,
    p_sparks: ev.quest.sparks,
  });
  if (error) throw error;
  const g = Array.isArray(data) ? data[0] : data;
  if (!row.claimed_at)
    await admin
      .from("event_progress")
      .update({ claimed_at: new Date().toISOString() })
      .eq("player_id", player.id)
      .eq("event_id", eventId)
      .is("claimed_at", null);
  const { data: p } = await admin.from("players").select("sparks, level").eq("id", player.id).single();
  return {
    ok: true,
    xp: g?.xp_added ?? 0,
    sparks: g?.sparks_added ?? 0,
    already: (g?.xp_added ?? 0) === 0 && (g?.sparks_added ?? 0) === 0,
    level: { before: g?.level_before ?? p?.level, after: g?.level_after ?? p?.level },
    balance: p?.sparks ?? player.sparks,
  };
}

/** Advances the active event's bonus quest after a verified clear. Returns the quest when this clear completed it. */
export async function advanceEventQuest(
  admin: SupabaseClient,
  playerId: string,
  c: { mode: string; world: string; hints: number },
): Promise<{ id: string; title: string } | null> {
  if (c.mode !== "free") return null;
  const e = await activeEvent(admin);
  if (!e) return null;
  const delta = eventQuestDelta(e.quest, c);
  if (!delta) return null;
  const { data, error } = await admin.rpc("svc_event_progress", { p_player: playerId, p_event: e.id, p_delta: delta, p_target: e.quest.n });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  return r?.completed ? { id: eventQuestId(e.id), title: e.quest.title } : null;
}
