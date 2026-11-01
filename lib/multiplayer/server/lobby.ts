import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { createRng } from "@/lib/rng";
import { DUEL_ROUNDS, PARTY_GAMES, PARTY_MIN, TIMING } from "../constants";
import { botTimes, firstRoundStart, newToGame, rankedPool, rulesBreakMs } from "../duel";
import { isRaceGame, pickGames } from "../games";
import { pickOpponent, type QueueEntry } from "../matchmaking";
import { CODE_ALPHABET, makeRoomCode, roomExpired } from "../roomCode";
import { loadMatch, matchTopic, member, touch, viewOf } from "./match";
import { readRating } from "./rewards";
import { knownGames } from "./known";
import { GAME_BY_ID } from "@/lib/catalog";
import { isAdultMode, type PartyMode } from "@/lib/party-adult/modes";
import { clearRounds, isAdultRoom, startAdult } from "./adult";

const iso = (n: number) => new Date(n).toISOString();
const secureRandom = () => randomInt(0, CODE_ALPHABET.length) / CODE_ALPHABET.length;

async function insertWithCode(admin: SupabaseClient, row: Record<string, unknown>): Promise<{ id: string; code: string }> {
  for (let i = 0; i < 12; i++) {
    const code = makeRoomCode(secureRandom);
    const { data, error } = await admin
      .from("matches")
      .insert({ ...row, code })
      .select("id, code")
      .single();
    if (!error) return data as { id: string; code: string };
    if (error.code !== "23505") throw error;
  }
  throw new ApiError(503, "no_code");
}

async function addPlayer(admin: SupabaseClient, matchId: string, playerId: string, seat: number, extra: Record<string, unknown> = {}) {
  const { error } = await admin
    .from("match_players")
    .upsert({ match_id: matchId, player_id: playerId, seat, left_at: null, last_seen_at: iso(Date.now()), ...extra });
  if (error) throw error;
}

/* ---------------- Duel: matchmaking ---------------- */

export async function enqueue(admin: SupabaseClient, player: { id: string; age_band: string }, game: string | null, rulesSeen = false) {
  if (player.age_band === "13-15") throw new ApiError(403, "age_restricted", "Quick Match opens at 16. Challenge a friend instead.");
  if (game && !isRaceGame(game)) throw new ApiError(400, "game_not_duelable");
  // A ranked game the player has never cleared or learned: read the rules first (the client shows a 20 s rules card).
  if (game && !rulesSeen && !(await knownGames(admin, [player.id], [game])).get(player.id)?.has(game))
    throw new ApiError(409, "needs_rules", GAME_BY_ID[game]?.rule ?? "");
  const [{ rating }, { data: me }] = await Promise.all([
    readRating(admin, player.id, "duel"),
    admin.from("players").select("country").eq("id", player.id).single(),
  ]);
  await admin.from("matchmaking_queue").upsert({
    player_id: player.id,
    game_id: game,
    rating: rating.toFixed(2),
    region: me?.country ?? null,
    enqueued_at: iso(Date.now()),
    match_id: null,
  });
  return pollQueue(admin, player.id);
}

export async function pollQueue(admin: SupabaseClient, playerId: string) {
  const { data: mine } = await admin.from("matchmaking_queue").select("*").eq("player_id", playerId).maybeSingle();
  if (!mine) return { status: "idle" as const };
  const rating = Math.round(Number(mine.rating));
  const waited = Date.now() - Date.parse(mine.enqueued_at);
  if (mine.match_id) return { status: "matched" as const, matchId: mine.match_id as string, rating, waitedMs: waited };
  const now = Date.now();
  const { data: others } = await admin
    .from("matchmaking_queue")
    .select("*")
    .is("match_id", null)
    .neq("player_id", playerId)
    .gte("enqueued_at", iso(now - 2 * 60_000))
    .order("enqueued_at")
    .limit(50);
  const toEntry = (r: {
    player_id: string;
    game_id: string | null;
    rating: number;
    region: string | null;
    enqueued_at: string;
  }): QueueEntry => ({
    playerId: r.player_id,
    gameId: r.game_id,
    rating: Number(r.rating),
    region: r.region,
    enqueuedAt: Date.parse(r.enqueued_at),
  });
  const me = toEntry(mine);
  const opp = pickOpponent(me, (others ?? []).map(toEntry), now);
  if (opp) {
    const matchId = await createDuel(admin, [me.playerId, opp.playerId], me.gameId ?? opp.gameId, { rated: true, claim: true });
    if (matchId) return { status: "matched" as const, matchId, rating, waitedMs: waited };
  }
  // Live data only (SPZ-12): how many others are searching right now. No estimated wait is shown.
  return { status: "searching" as const, rating, waitedMs: waited, searching: (others ?? []).length };
}

export async function cancelQueue(admin: SupabaseClient, playerId: string) {
  await admin.from("matchmaking_queue").delete().eq("player_id", playerId).is("match_id", null);
}

async function createDuel(
  admin: SupabaseClient,
  players: string[],
  game: string | null,
  o: { rated: boolean; claim?: boolean; bot?: boolean; rematchOf?: string },
): Promise<string | null> {
  const id = randomUUID();
  const rng = createRng(`duel:${id}`);
  // Ranked games between people: what each player knows picks the mix and the rules breaks.
  const known = o.rated && !o.bot ? await knownGames(admin, players) : null;
  const games = pickGames(rng, game, DUEL_ROUNDS, !game && known ? rankedPool(known) : undefined);
  // A first round that is new to either player starts after a rules break (both wait the same).
  const rulesMs = known ? rulesBreakMs(newToGame(games[0], players, known)) : 0;
  const now = Date.now();
  const { error } = await admin.from("matches").insert({
    id,
    kind: "duel",
    status: o.claim ? "queue" : "playing",
    host_id: players[0],
    game_id: game,
    mix: !game,
    games,
    rated: o.rated,
    is_bot: !!o.bot,
    best_of: DUEL_ROUNDS,
    round: 1,
    round_started_at: iso(firstRoundStart(now) + rulesMs),
    bot_ms: o.bot ? botTimes(70_000, [rng.next(), rng.next(), rng.next()]) : [],
  });
  if (error) throw error;
  if (o.claim) {
    const { data: ok, error: e2 } = await admin.rpc("svc_mm_claim", { p_players: players, p_match: id });
    if (e2) throw e2;
    if (!ok) {
      await admin.from("matches").delete().eq("id", id);
      return null;
    }
  }
  for (let i = 0; i < players.length; i++) await addPlayer(admin, id, players[i], i, { ready: true });
  if (o.claim)
    await admin
      .from("matches")
      .update({ status: "playing", round_started_at: iso(firstRoundStart(Date.now()) + rulesMs) })
      .eq("id", id);
  return id;
}

/** Practice bot after 20 s of searching (SRS 12.2). Clearly labelled, unrated. */
export async function practiceBot(admin: SupabaseClient, playerId: string, game: string | null) {
  const { data: q } = await admin
    .from("matchmaking_queue")
    .select("enqueued_at, match_id, game_id")
    .eq("player_id", playerId)
    .maybeSingle();
  if (q?.match_id) return { matchId: q.match_id as string };
  // The Practice bot is unrated, so it is offered from the start (SPZ-12); no waiting rule needed.
  await cancelQueue(admin, playerId);
  const id = await createDuel(admin, [playerId], game ?? q?.game_id ?? null, { rated: false, bot: true });
  return { matchId: id! };
}

/* ---------------- Duel: challenge a friend (unranked, by link) ---------------- */

export async function friendDuel(admin: SupabaseClient, playerId: string, game: string | null) {
  if (game && !isRaceGame(game)) throw new ApiError(400, "game_not_duelable");
  const id = randomUUID();
  const games = pickGames(createRng(`duel:${id}`), game, DUEL_ROUNDS);
  const row = await insertWithCode(admin, {
    id,
    kind: "duel",
    status: "lobby",
    host_id: playerId,
    game_id: game,
    mix: !game,
    games,
    rated: false,
    best_of: DUEL_ROUNDS,
  });
  await addPlayer(admin, id, playerId, 0, { ready: true });
  return { matchId: row.id, code: row.code };
}

export async function joinFriendDuel(admin: SupabaseClient, playerId: string, code: string) {
  const { data: m } = await admin.from("matches").select("id, status, host_id, kind").eq("code", code).eq("kind", "duel").maybeSingle();
  if (!m) throw new ApiError(404, "room_not_found");
  if (m.host_id === playerId) return { matchId: m.id as string };
  const l = await loadMatch(admin, m.id);
  if (l.players.some((p) => p.player_id === playerId)) return { matchId: m.id as string };
  if (m.status !== "lobby" || l.players.length >= 2) throw new ApiError(409, "duel_full");
  await addPlayer(admin, m.id, playerId, 1, { ready: true });
  const { data } = await admin
    .from("matches")
    .update({ status: "playing", round: 1, round_started_at: iso(firstRoundStart(Date.now())), code: null })
    .eq("id", m.id)
    .eq("status", "lobby")
    .select("id");
  if (!data?.length) throw new ApiError(409, "duel_full");
  await serverBroadcast(matchTopic(m.id), "changed", { reason: "start" });
  return { matchId: m.id as string };
}

/* ---------------- Rematch ---------------- */

export async function rematch(admin: SupabaseClient, id: string, playerId: string) {
  const l = await loadMatch(admin, id);
  const me = member(l, playerId);
  if (l.m.kind !== "duel" || l.m.status !== "finished") throw new ApiError(409, "not_finished");
  if (l.m.rematch_id) return { matchId: l.m.rematch_id, waiting: false };
  // Asking for a rematch brings a player who left back into the room.
  await admin.from("match_players").update({ rematch: true, left_at: null }).eq("match_id", id).eq("player_id", playerId);
  me.rematch = true;
  me.left_at = null;
  const humans = l.players.filter((p) => !p.spectator);
  const everyone = l.m.is_bot || humans.every((p) => p.rematch && !p.left_at);
  if (!everyone) {
    await serverBroadcast(matchTopic(id), "changed", { reason: "rematch_request", player: playerId });
    return { matchId: null, waiting: true };
  }
  const next = await createDuel(
    admin,
    humans.map((p) => p.player_id),
    l.m.mix ? null : l.m.game_id,
    { rated: l.m.rated, bot: l.m.is_bot },
  );
  const { data } = await admin.from("matches").update({ rematch_id: next }).eq("id", id).is("rematch_id", null).select("id");
  if (!data?.length) {
    await admin.from("matches").delete().eq("id", next!);
    const fresh = await loadMatch(admin, id);
    return { matchId: fresh.m.rematch_id, waiting: false };
  }
  await serverBroadcast(matchTopic(id), "changed", { reason: "rematch", matchId: next });
  return { matchId: next, waiting: false };
}

/* ---------------- Party rooms ---------------- */

export interface RoomInput {
  game: string | null;
  /** hand-picked games (2 to 8); when set, each set races PARTY_GAMES of them and `game` is ignored */
  games?: string[] | null;
  difficulty: "easy" | "medium" | "hard" | "expert";
  maxPlayers: number;
  classroom: boolean;
  /** "race" (default) or an 18+ party game; the route checks the age gate before an 18+ room is opened */
  mode?: PartyMode;
}

export async function createRoom(admin: SupabaseClient, playerId: string, input: RoomInput) {
  if (isAdultMode(input.mode)) {
    // Draw It and Two Truths: no puzzle, no classroom; everyone takes a turn.
    const row = await insertWithCode(admin, {
      kind: "race",
      status: "lobby",
      host_id: playerId,
      game_id: null,
      mix: false,
      party_mode: input.mode,
      max_players: input.maxPlayers,
      classroom: false,
      best_of: 0,
    });
    await addPlayer(admin, row.id, playerId, 0, { ready: true });
    return { matchId: row.id, code: row.code };
  }
  if (input.game && !isRaceGame(input.game)) throw new ApiError(400, "game_not_raceable");
  if (input.games?.some((g) => !isRaceGame(g))) throw new ApiError(400, "game_not_raceable");
  const picks = input.games?.length ? input.games : [];
  const game = picks.length ? null : input.game;
  const row = await insertWithCode(admin, {
    kind: "race",
    status: "lobby",
    host_id: playerId,
    game_id: game,
    mix: !game,
    chosen_games: picks,
    difficulty: input.difficulty,
    max_players: input.maxPlayers,
    classroom: input.classroom,
    best_of: PARTY_GAMES,
  });
  await addPlayer(admin, row.id, playerId, 0, { ready: true, spectator: input.classroom });
  return { matchId: row.id, code: row.code };
}

/** The room row for a code (Party rooms only); 404 when missing or expired. */
export async function roomMatch(admin: SupabaseClient, code: string) {
  const { data: m } = await admin.from("matches").select("*").eq("code", code).eq("kind", "race").maybeSingle();
  if (!m || roomExpired(m.emptied_at)) throw new ApiError(404, "room_not_found");
  return m as { id: string; emptied_at: string | null; status: string; party_mode?: PartyMode };
}

/**
 * Age gate for 18+ rooms (Draw It, Two Truths), passed in by the routes: it runs before anything about such a
 * room is shown or changed, so a player who may not see these modes gets a 403 and nothing else.
 */
export type AdultGate = () => Promise<unknown>;

const denyAdult = async () => {
  throw new ApiError(403, "adults_only");
};

/** Public lobby card for someone holding a code (before joining). */
export async function roomPreview(admin: SupabaseClient, code: string, playerId: string, gate?: AdultGate) {
  const m = await roomMatch(admin, code);
  if (isAdultRoom(m)) await (gate ?? denyAdult)();
  const l = await loadMatch(admin, m.id);
  const mine = l.players.find((p) => p.player_id === playerId && !p.left_at);
  if (mine) return { member: true as const, view: await viewOf(admin, l, playerId) };
  const here = l.players.filter((p) => !p.left_at);
  const host = here.find((p) => p.player_id === l.m.host_id);
  return {
    member: false as const,
    room: {
      code,
      status: l.m.status,
      game: l.m.game_id,
      mix: l.m.mix,
      chosen: l.m.chosen_games ?? [],
      count: here.filter((p) => !p.spectator).length,
      max: l.m.max_players,
      host: host?.players?.nickname ?? null,
      mode: m.party_mode ?? "race",
    },
  };
}

export async function joinRoom(admin: SupabaseClient, playerId: string, code: string, gate?: AdultGate) {
  const m = await roomMatch(admin, code);
  // Join-time enforcement: an 18+ room only ever holds signed-in 18+ players.
  if (isAdultRoom(m)) await (gate ?? denyAdult)();
  const l = await loadMatch(admin, m.id);
  const existing = l.players.find((p) => p.player_id === playerId);
  if (existing?.kicked_at) throw new ApiError(403, "kicked", "The host removed you from this room.");
  if (existing && !existing.left_at) return { matchId: m.id };
  if (l.m.status !== "lobby" && !existing) throw new ApiError(409, "race_running", "This race already started. Catch the next one.");
  const here = l.players.filter((p) => !p.left_at && !p.spectator);
  if (here.length >= l.m.max_players) throw new ApiError(409, "room_full");
  const seat = existing?.seat ?? Math.max(-1, ...l.players.map((p) => p.seat)) + 1;
  await addPlayer(admin, m.id, playerId, seat, { ready: false, rematch: false });
  const patch: Record<string, unknown> = { emptied_at: null, updated_at: iso(Date.now()) };
  if (!l.players.some((p) => !p.left_at && p.player_id === l.m.host_id)) patch.host_id = playerId;
  await admin.from("matches").update(patch).eq("id", m.id);
  const { data: me } = await admin.from("players").select("nickname").eq("id", playerId).single();
  await serverBroadcast(matchTopic(m.id), "changed", { reason: "join", player: playerId, nickname: me?.nickname });
  return { matchId: m.id };
}

async function roomForHost(admin: SupabaseClient, code: string, playerId: string, hostOnly: boolean) {
  const m = await roomMatch(admin, code);
  const l = await loadMatch(admin, m.id);
  const me = member(l, playerId);
  if (me.left_at) throw new ApiError(403, "not_in_match");
  if (hostOnly && l.m.host_id !== playerId) throw new ApiError(403, "host_only");
  await touch(admin, l, playerId);
  return l;
}

export async function setReady(admin: SupabaseClient, playerId: string, code: string, ready: boolean) {
  const l = await roomForHost(admin, code, playerId, false);
  if (l.m.status !== "lobby") throw new ApiError(409, "not_lobby");
  await admin.from("match_players").update({ ready }).eq("match_id", l.m.id).eq("player_id", playerId);
  await serverBroadcast(matchTopic(l.m.id), "changed", { reason: "ready", player: playerId, ready });
  return { ok: true };
}

export async function roomSettings(admin: SupabaseClient, playerId: string, code: string, s: Partial<RoomInput>) {
  const l = await roomForHost(admin, code, playerId, true);
  if (l.m.status !== "lobby") throw new ApiError(409, "not_lobby");
  if (isAdultRoom(l.m)) throw new ApiError(409, "no_settings");
  if (s.game && !isRaceGame(s.game)) throw new ApiError(400, "game_not_raceable");
  if (s.games?.some((g) => !isRaceGame(g))) throw new ApiError(400, "game_not_raceable");
  const patch: Record<string, unknown> = {};
  if (s.game !== undefined) Object.assign(patch, { game_id: s.game, mix: !s.game, chosen_games: [] });
  if (s.games?.length) Object.assign(patch, { game_id: null, mix: true, chosen_games: s.games });
  else if (s.games === null) patch.chosen_games = [];
  if (s.difficulty) patch.difficulty = s.difficulty;
  await admin.from("matches").update(patch).eq("id", l.m.id);
  await serverBroadcast(matchTopic(l.m.id), "changed", { reason: "settings" });
  return { ok: true };
}

export async function startRoom(admin: SupabaseClient, playerId: string, code: string) {
  const l = await roomForHost(admin, code, playerId, true);
  if (l.m.status !== "lobby") throw new ApiError(409, "not_lobby");
  const racers = l.players.filter((p) => !p.left_at && !p.spectator);
  if (racers.length < PARTY_MIN) throw new ApiError(409, "need_players", "Two Spuzlers make a race. Share the code.");
  const waiting = racers.find((p) => !p.ready);
  if (waiting) throw new ApiError(409, "not_ready", `${waiting.players?.nickname ?? "Someone"} is still getting ready.`);
  if (isAdultRoom(l.m)) {
    await startAdult(admin, l);
    return { ok: true };
  }
  // One game every round, PARTY_GAMES of the host's picks (shuffled per set), or a random mix.
  const games = pickGames(createRng(`party:${l.m.id}:${l.m.set_no}`), l.m.game_id, PARTY_GAMES, l.m.chosen_games);
  await admin
    .from("match_players")
    .update({ points: 0, place: null, progress: 0, mistakes: 0, finished_ms: null, state: null })
    .eq("match_id", l.m.id);
  const { data } = await admin
    .from("matches")
    .update({
      status: "playing",
      round: 1,
      games,
      round_started_at: iso(Date.now() + TIMING.countdownMs),
      round_first_at: null,
      winner_id: null,
      result: null,
    })
    .eq("id", l.m.id)
    .eq("status", "lobby")
    .select("id");
  if (!data?.length) throw new ApiError(409, "not_lobby");
  await serverBroadcast(matchTopic(l.m.id), "changed", { reason: "start" });
  return { ok: true };
}

export async function nextGame(admin: SupabaseClient, playerId: string, code: string) {
  const l = await roomForHost(admin, code, playerId, true);
  if (l.m.status !== "round_end") throw new ApiError(409, "not_podium");
  const { data, error } = await admin.rpc("svc_match_commit", {
    p_match: l.m.id,
    p_expect_status: "round_end",
    p_expect_round: l.m.round,
    p_status: "playing",
    p_round: l.m.round + 1,
    p_round_started_at: iso(Date.now() + TIMING.countdownMs),
    p_winner: null,
    p_result: null,
    p_bot_rounds_won: null,
    p_players: [],
    p_rounds: [],
  });
  if (error) throw error;
  if (data) await serverBroadcast(matchTopic(l.m.id), "changed", { reason: "next" });
  return { ok: true };
}

/** "Run it back": back to the lobby with the same people, a new set and fresh puzzles. */
export async function runItBack(admin: SupabaseClient, playerId: string, code: string) {
  const l = await roomForHost(admin, code, playerId, true);
  if (l.m.status !== "finished" && l.m.status !== "round_end") throw new ApiError(409, "not_finished");
  if (isAdultRoom(l.m)) await clearRounds(admin, l.m.id);
  await admin
    .from("match_players")
    .update({ ready: false, points: 0, place: null, progress: 0, mistakes: 0, finished_ms: null, state: null })
    .eq("match_id", l.m.id);
  await admin.from("match_players").update({ ready: true }).eq("match_id", l.m.id).eq("player_id", playerId);
  const { data } = await admin
    .from("matches")
    .update({
      status: "lobby",
      round: 1,
      set_no: l.m.set_no + 1,
      games: [],
      round_started_at: null,
      round_first_at: null,
      winner_id: null,
      result: null,
      finished_at: null,
    })
    .eq("id", l.m.id)
    .eq("set_no", l.m.set_no)
    .select("id");
  if (data?.length) await serverBroadcast(matchTopic(l.m.id), "changed", { reason: "lobby" });
  return { ok: true };
}
