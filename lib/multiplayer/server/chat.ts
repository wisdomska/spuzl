import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, rateLimit } from "@/lib/api/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { effectiveBand } from "@/lib/age";
import { isUnder16 } from "@/lib/social";
import { partyTextProblem } from "@/lib/party-adult/filter";
import { CHAT_BURST, CHAT_MAX, QUICK_PHRASES, type ChatMessage } from "../chat";
import { matchTopic } from "./match";

type Seat = {
  player_id: string;
  players: {
    nickname: string;
    avatar_color: string | null;
    age_band: string | null;
    birth_year: number | null;
    birth_month: number | null;
  } | null;
};

async function seats(admin: SupabaseClient, matchId: string): Promise<Seat[]> {
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) throw new ApiError(404, "match_not_found");
  const { data: m } = await admin.from("matches").select("id, is_bot").eq("id", matchId).maybeSingle();
  if (!m) throw new ApiError(404, "match_not_found");
  const { data } = await admin
    .from("match_players")
    .select("player_id, players(nickname, avatar_color, age_band, birth_year, birth_month)")
    .eq("match_id", matchId);
  return (data ?? []) as unknown as Seat[];
}

/** Typing is for 16+ rooms: one player under 16 anywhere in the room means quick phrases for everyone. */
const typingAllowed = (all: Seat[]) => !all.some((s) => !s.players || isUnder16(effectiveBand(s.players)));

/** Messages after `after` (an id), oldest first, at most 50; plus whether this room may type. */
export async function listChat(admin: SupabaseClient, matchId: string, me: string, after = 0) {
  const all = await seats(admin, matchId);
  if (!all.some((s) => s.player_id === me)) throw new ApiError(403, "not_in_match");
  const { data } = await admin
    .from("match_messages")
    .select("id, player_id, kind, body, created_at")
    .eq("match_id", matchId)
    .gt("id", after)
    .order("id", { ascending: true })
    .limit(50);
  const who = new Map(all.map((s) => [s.player_id, s.players]));
  const messages: ChatMessage[] = (data ?? []).map((r) => ({
    id: Number(r.id),
    from: r.player_id as string,
    nickname: who.get(r.player_id as string)?.nickname ?? "Spuzler",
    color: who.get(r.player_id as string)?.avatar_color ?? "#B8F23A",
    kind: r.kind as "text" | "quick",
    body: r.body as string,
    at: Date.parse(r.created_at as string),
  }));
  return { messages, typing: typingAllowed(all) };
}

/** Posts a quick phrase (by index) or, in a 16+ room, a typed line that passes the filter. */
export async function postChat(admin: SupabaseClient, matchId: string, me: string, input: { quick?: number; text?: string }) {
  const all = await seats(admin, matchId);
  if (!all.some((s) => s.player_id === me)) throw new ApiError(403, "not_in_match");
  await rateLimit(admin, `chat:${matchId}:${me}`, CHAT_BURST, 30);
  let kind: "quick" | "text";
  let body: string;
  if (input.quick !== undefined) {
    const q = QUICK_PHRASES[input.quick];
    if (!q) throw new ApiError(400, "bad_phrase");
    kind = "quick";
    body = q;
  } else {
    if (!typingAllowed(all)) throw new ApiError(403, "quick_only", "This room uses quick messages only.");
    const text = (input.text ?? "").replace(/\s+/g, " ").trim();
    const problem = partyTextProblem(text, "statement");
    if (problem === "empty") throw new ApiError(400, "empty");
    if (problem === "too_long" || text.length > CHAT_MAX) throw new ApiError(400, "too_long", `Keep it under ${CHAT_MAX} characters.`);
    if (problem === "contact") throw new ApiError(400, "contact", "No numbers, links or handles in chat.");
    if (problem) throw new ApiError(400, "blocked", "Let's keep it friendly. Try other words.");
    kind = "text";
    body = text;
  }
  const { data, error } = await admin.from("match_messages").insert({ match_id: matchId, player_id: me, kind, body }).select("id").single();
  if (error) throw error;
  // A ping only: devices fetch the message from the server, so nothing typed reaches anyone unfiltered.
  await serverBroadcast(matchTopic(matchId), "chat", { id: Number(data.id) });
  return { id: Number(data.id) };
}
