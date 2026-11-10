import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, rateLimit } from "@/lib/api/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { effectiveBand } from "@/lib/age";
import { isUnder16 } from "@/lib/social";
import { partyTextProblem } from "@/lib/party-adult/filter";
import { isAdultMode } from "@/lib/party-adult/modes";
import { CHAT_BURST, CHAT_MAX, QUICK_PHRASES, type ChatMessage } from "../chat";
import { matchTopic } from "./match";
import { BOT_PLAYER, bayTopic } from "./bay";

type Seat = {
  player_id: string;
  players: {
    nickname: string;
    avatar_color: string | null;
    hat: string | null;
    age_band: string | null;
    birth_year: number | null;
    birth_month: number | null;
  } | null;
};

/** A chat room: a Duel or Party match, or a Board Games match. */
export type ChatRoom = { kind: "match" | "bay"; id: string };

const PLAYER_COLS = "nickname, avatar_color, hat:owned_hat, age_band, birth_year, birth_month";

async function seats(admin: SupabaseClient, room: ChatRoom): Promise<Seat[]> {
  if (!/^[0-9a-f-]{36}$/i.test(room.id)) throw new ApiError(404, "match_not_found");
  if (room.kind === "bay") {
    const { data: b } = await admin.from("board_matches").select("id, players").eq("id", room.id).maybeSingle();
    if (!b) throw new ApiError(404, "match_not_found");
    const ids = (b.players as string[]).filter((p) => p !== BOT_PLAYER);
    const { data } = await admin
      .from("players")
      .select(`id, ${PLAYER_COLS}`)
      .in("id", ids.length ? ids : [BOT_PLAYER]);
    return (data ?? []).map((p) => ({ player_id: p.id as string, players: p as unknown as Seat["players"] }));
  }
  const { data: m } = await admin.from("matches").select("id, is_bot").eq("id", room.id).maybeSingle();
  if (!m) throw new ApiError(404, "match_not_found");
  const { data } = await admin.from("match_players").select(`player_id, players(${PLAYER_COLS})`).eq("match_id", room.id);
  return (data ?? []) as unknown as Seat[];
}

async function adultRoom(admin: SupabaseClient, room: ChatRoom): Promise<boolean> {
  if (room.kind !== "match") return false;
  const { data } = await admin.from("matches").select("kind, party_mode").eq("id", room.id).maybeSingle();
  return data?.kind === "race" && isAdultMode(data.party_mode);
}

const roomCol = (room: ChatRoom) => (room.kind === "bay" ? "bay_id" : "match_id");

/** Typing is for 16+ rooms: one player under 16 anywhere in the room means quick phrases for everyone. */
const typingAllowed = (all: Seat[]) => !all.some((s) => !s.players || isUnder16(effectiveBand(s.players)));

/** Messages after `after` (an id), oldest first, at most 50; plus whether this room may type. */
export async function listChat(admin: SupabaseClient, room: ChatRoom, me: string, after = 0) {
  const all = await seats(admin, room);
  if (!all.some((s) => s.player_id === me)) throw new ApiError(403, "not_in_match");
  const { data } = await admin
    .from("match_messages")
    .select("id, player_id, kind, body, created_at")
    .eq(roomCol(room), room.id)
    .gt("id", after)
    .order("id", { ascending: true })
    .limit(50);
  const who = new Map(all.map((s) => [s.player_id, s.players]));
  const messages: ChatMessage[] = (data ?? []).map((r) => ({
    id: Number(r.id),
    from: r.player_id as string,
    nickname: who.get(r.player_id as string)?.nickname ?? "Spuzler",
    color: who.get(r.player_id as string)?.avatar_color ?? "#B8F23A",
    hat: who.get(r.player_id as string)?.hat ?? null,
    kind: r.kind as "text" | "quick",
    body: r.body as string,
    at: Date.parse(r.created_at as string),
  }));
  return { messages, typing: typingAllowed(all) };
}

/** Posts a quick phrase (by index) or, in a 16+ room, a typed line that passes the filter. */
export async function postChat(admin: SupabaseClient, room: ChatRoom, me: string, input: { quick?: number; text?: string }) {
  const all = await seats(admin, room);
  if (!all.some((s) => s.player_id === me)) throw new ApiError(403, "not_in_match");
  await rateLimit(admin, `chat:${room.id}:${me}`, CHAT_BURST, 30);
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
    // 18+ party rooms (Two Truths, Draw It): no word filter, as in their games; contact details are still refused
    const problem = partyTextProblem(text, "statement", { words: !(await adultRoom(admin, room)) });
    if (problem === "empty") throw new ApiError(400, "empty");
    if (problem === "too_long" || text.length > CHAT_MAX) throw new ApiError(400, "too_long", `Keep it under ${CHAT_MAX} characters.`);
    if (problem === "contact") throw new ApiError(400, "contact", "No numbers, links or handles in chat.");
    if (problem) throw new ApiError(400, "blocked", "Let's keep it friendly. Try other words.");
    kind = "text";
    body = text;
  }
  const { data, error } = await admin
    .from("match_messages")
    .insert({ [roomCol(room)]: room.id, player_id: me, kind, body })
    .select("id")
    .single();
  if (error) throw error;
  // A ping only: devices fetch the message from the server, so nothing typed reaches anyone unfiltered.
  await serverBroadcast(room.kind === "bay" ? bayTopic(room.id) : matchTopic(room.id), "chat", { id: Number(data.id) });
  return { id: Number(data.id) };
}
