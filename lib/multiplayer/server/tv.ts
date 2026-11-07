import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { canHostTv, spectatorView } from "../tv";
import { isAdultRoom } from "./adult";
import { roomMatch } from "./lobby";
import { loadMatch, matchTopic, member, viewOf, type Loaded } from "./match";

/**
 * Big-screen spectator view of a Party room (R2-P5). Read access is decided here for every request: the admin
 * switch "features.partyTv", a race room (never Draw It or Two Truths), the host's per-room switch (tv_open), and
 * a host 16 or over. The answer is `spectatorView`: nicknames and scores only.
 */

async function assertTvOn() {
  if (!(await getGameSettings())["features.partyTv"]) throw new ApiError(404, "tv_off", "Big-screen view is switched off for now.");
}

const hostRow = (l: Loaded) => l.players.find((p) => p.player_id === l.m.host_id)?.players ?? null;

/** GET /api/v1/rooms/<code>/tv: the room as a spectator sees it. */
export async function tvView(admin: SupabaseClient, code: string) {
  await assertTvOn();
  const m = await roomMatch(admin, code);
  if (isAdultRoom(m)) throw new ApiError(404, "room_not_found");
  const l = await loadMatch(admin, m.id);
  if (!l.m.tv_open || !canHostTv(hostRow(l))) throw new ApiError(403, "tv_closed", "The host hasn't opened this room to watchers.");
  return spectatorView(await viewOf(admin, l, ""));
}

/** POST /api/v1/rooms/<code>/tv: the host opens or closes the room to spectators, at any point in the room. */
export async function setTvOpen(admin: SupabaseClient, playerId: string, code: string, open: boolean) {
  await assertTvOn();
  const m = await roomMatch(admin, code);
  if (isAdultRoom(m)) throw new ApiError(409, "no_settings");
  const l = await loadMatch(admin, m.id);
  const me = member(l, playerId);
  if (me.left_at) throw new ApiError(403, "not_in_match");
  if (l.m.host_id !== playerId) throw new ApiError(403, "host_only");
  if (open && !canHostTv(me.players)) throw new ApiError(403, "age_restricted", "Big-screen view opens for hosts 16 and over.");
  const { error } = await admin.from("matches").update({ tv_open: open }).eq("id", m.id);
  if (error) throw error;
  await serverBroadcast(matchTopic(m.id), "changed", { reason: "settings" });
  return { tvOpen: open };
}
