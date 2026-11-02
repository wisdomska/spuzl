import "server-only";
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { bayLive } from "@/lib/copy/bay-live";
import { LIVE_CLOCK_MS, initialState, isBayGame, loadRules, type BayGame } from "../bay";
import { BAY_QUEUE, isLive, pickBayOpponent, searchTimedOut, seatOrder, type BayQueueEntry } from "../bayMatchmaking";
import { readRating } from "./rewards";

/**
 * Board Bay "Play live": a server-side queue per game (table board_queue, one entry per player).
 * Every join and poll tries to pair the caller; the pair is claimed atomically (svc_bay_mm_claim, which also
 * refuses blocked pairs), then both players are told on their own realtime topic and on their next poll.
 */

const iso = (n: number) => new Date(n).toISOString();

interface QueueRow {
  player_id: string;
  game_id: BayGame;
  rating: number | string;
  has_rating: boolean;
  enqueued_at: string;
  seen_at: string;
  match_id: string | null;
}

const toEntry = (r: QueueRow): BayQueueEntry => ({
  playerId: r.player_id,
  game: r.game_id,
  rating: Number(r.rating),
  hasRating: r.has_rating,
  enqueuedAt: Date.parse(r.enqueued_at),
  seenAt: Date.parse(r.seen_at),
});

export type BayQueueStatus =
  | { status: "idle" }
  | { status: "searching"; game: BayGame; waitedMs: number; searching: number; timeoutMs: number }
  | { status: "matched"; game: BayGame; matchId: string }
  | { status: "timeout"; game: BayGame };

/**
 * Joins (or rejoins) the live queue for `game`. Under-16s are kept out, the same as Duel Quick Match.
 * A player has one search at a time: this replaces any Board Bay or Duel search they had. Rejoining the same
 * game within the reconnect window keeps their place in the line.
 */
export async function joinBayQueue(admin: SupabaseClient, player: { id: string; age_band: string }, game: string) {
  if (player.age_band === "13-15") throw new ApiError(403, "age_restricted", bayLive.ageRestricted);
  if (!isBayGame(game)) throw new ApiError(400, "not_board_game");
  // One queue entry per player across modes: joining here ends a Duel Quick Match search.
  await admin.from("matchmaking_queue").delete().eq("player_id", player.id).is("match_id", null);
  const now = Date.now();
  const [{ data: existing }, rating] = await Promise.all([
    admin.from("board_queue").select("*").eq("player_id", player.id).maybeSingle(),
    readRating(admin, player.id, `board:${game}`),
  ]);
  const prev = existing as QueueRow | null;
  const resume = !!prev && !prev.match_id && prev.game_id === game && isLive(toEntry(prev), now);
  const { error } = await admin.from("board_queue").upsert({
    player_id: player.id,
    game_id: game,
    rating: rating.rating.toFixed(2),
    has_rating: rating.games > 0,
    enqueued_at: resume ? prev!.enqueued_at : iso(now),
    seen_at: iso(now),
    match_id: null,
  });
  if (error) throw error;
  return pollBayQueue(admin, player.id);
}

/** Poll while searching: refreshes the entry, pairs when someone fits, and ends the search after a minute. */
export async function pollBayQueue(admin: SupabaseClient, playerId: string): Promise<BayQueueStatus> {
  const { data } = await admin.from("board_queue").select("*").eq("player_id", playerId).maybeSingle();
  if (!data) return { status: "idle" };
  const mine = data as QueueRow;
  if (mine.match_id) {
    // Reconnect: a search that found a match that is still on goes straight back to it. An old pairing is forgotten.
    const { data: m } = await admin.from("board_matches").select("status").eq("id", mine.match_id).maybeSingle();
    if (m && (m.status === "active" || m.status === "waiting")) return { status: "matched", game: mine.game_id, matchId: mine.match_id };
    await admin.from("board_queue").delete().eq("player_id", playerId).eq("match_id", mine.match_id);
    return { status: "idle" };
  }
  const now = Date.now();
  const me = toEntry(mine);
  if (searchTimedOut(me.enqueuedAt, now)) {
    await cancelBayQueue(admin, playerId);
    return { status: "timeout", game: mine.game_id };
  }
  me.seenAt = now;
  await admin
    .from("board_queue")
    .update({ seen_at: iso(now) })
    .eq("player_id", playerId)
    .is("match_id", null);

  const [{ data: rows }, { data: blockRows }] = await Promise.all([
    admin
      .from("board_queue")
      .select("*")
      .eq("game_id", mine.game_id)
      .is("match_id", null)
      .neq("player_id", playerId)
      .gte("seen_at", iso(now - BAY_QUEUE.staleMs))
      .gte("enqueued_at", iso(now - BAY_QUEUE.timeoutMs))
      .order("enqueued_at")
      .limit(50),
    admin.from("blocks").select("player_id, blocked_id").or(`player_id.eq.${playerId},blocked_id.eq.${playerId}`),
  ]);
  const others = ((rows ?? []) as QueueRow[]).map(toEntry);
  const blocks = (blockRows ?? []).map((b) => [b.player_id as string, b.blocked_id as string] as const);
  const opp = pickBayOpponent(me, others, now, blocks);
  if (opp) {
    const matchId = await createMatched(admin, [me.playerId, opp.playerId], mine.game_id);
    if (matchId) return { status: "matched", game: mine.game_id, matchId };
  }
  const visible = others.filter((o) => !blocks.some(([x, y]) => x === o.playerId || y === o.playerId));
  return {
    status: "searching",
    game: mine.game_id,
    waitedMs: now - me.enqueuedAt,
    searching: visible.length,
    timeoutMs: BAY_QUEUE.timeoutMs,
  };
}

/** Cancel (or leaving the search screen). A search that already found a match is left alone. */
export async function cancelBayQueue(admin: SupabaseClient, playerId: string) {
  await admin.from("board_queue").delete().eq("player_id", playerId).is("match_id", null);
}

/**
 * Creates the live match for a pair and claims both queue entries in one step. Returns null when either
 * player was taken by someone else first (or a block appeared): the caller just keeps searching.
 */
async function createMatched(admin: SupabaseClient, pair: [string, string], game: BayGame): Promise<string | null> {
  const rules = await loadRules(game);
  const seed = crypto.randomUUID();
  const state = initialState(rules, 2, seed);
  const players = seatOrder(pair[0], pair[1], randomInt(0, 1_000_000) / 1_000_000);
  // Created as "waiting" with no invite code (nobody can join it by link), then started once the claim holds.
  const { data: row, error } = await admin
    .from("board_matches")
    .insert({
      game_id: game,
      mode: "live",
      status: "waiting",
      players,
      seats: 2,
      turn: rules.turn(state),
      state,
      seed,
      invite_code: null,
      rated: true,
      bot: false,
      created_by: pair[0],
      clock_ms: [LIVE_CLOCK_MS, LIVE_CLOCK_MS],
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = row.id as string;
  const { data: ok, error: e2 } = await admin.rpc("svc_bay_mm_claim", { p_players: pair, p_game: game, p_match: id });
  if (e2 || !ok) {
    await admin.from("board_matches").delete().eq("id", id);
    if (e2) throw e2;
    return null;
  }
  const now = Date.now();
  await admin
    .from("board_matches")
    .update({ status: "active", turn_started_at: iso(now), updated_at: iso(now) })
    .eq("id", id)
    .eq("status", "waiting");
  await Promise.all(players.map((p) => serverBroadcast(`user:${p}`, "bay_matched", { matchId: id, game })));
  return id;
}
