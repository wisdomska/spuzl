import "server-only";
import { headToHead } from "./h2h";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { TIMING, countdownMsFor } from "../constants";
import { BOT_ID, matchState, newToGame, nextRoundStart, resolveRound, rulesBreakMs, type Finisher } from "../duel";
import { placeRace, raceOver, nextHost, type Racer } from "../race";
import { validateProgress } from "../progress";
import type { MatchPlayerView, MatchRoundView, MatchView } from "../types";
import { roundPuzzle } from "./puzzles";
import { getGameSettings } from "@/lib/game-settings/server";
import { adultRewardFor, finalizeDuel, finalizeRace } from "./rewards";
import { knownGames } from "./known";
import { adultRoundView, isAdultRoom, modeOf, resolveAdult } from "./adult";
import type { PartyMode } from "@/lib/party-adult/modes";
import { bindPuzzle } from "@/lib/game/guess-token";
import { effectiveBand } from "@/lib/age";
import { isUnder16 } from "@/lib/social";

export const matchTopic = (id: string) => `match:${id}`;

/** The live countdown length (admin setting party.countdownSeconds, shared by Duel and Party), in ms. */
export async function liveCountdownMs(): Promise<number> {
  return countdownMsFor((await getGameSettings())["party.countdownSeconds"]);
}

/**
 * When a round's puzzle goes out: as its countdown begins. A Party round is started `startBufferMs` ahead of its
 * countdown, so the puzzle is ready for the whole lead-in. Moves are still refused until the start itself.
 */
export function puzzleShowsAt(kind: MatchRow["kind"], start: number, countdownMs: number): number {
  return start - countdownMs - (kind === "race" ? TIMING.startBufferMs : 0);
}

export interface MatchRow {
  id: string;
  kind: "duel" | "race";
  code: string | null;
  host_id: string | null;
  game_id: string | null;
  mix: boolean;
  status: MatchView["status"];
  round: number;
  best_of: number;
  puzzle_seeds: string[];
  round_started_at: string | null;
  region: string | null;
  is_bot: boolean;
  winner_id: string | null;
  created_at: string;
  emptied_at: string | null;
  finished_at: string | null;
  difficulty: string;
  games: string[];
  /** party: the host's hand-picked games (empty: one game or a random mix) */
  chosen_games: string[];
  max_players: number;
  classroom: boolean;
  rated: boolean;
  set_no: number;
  pause_ms: number;
  paused_at: string | null;
  round_first_at: string | null;
  bot_ms: number[];
  bot_rounds_won: number;
  result: string | null;
  rematch_id: string | null;
  /** 18+ party games (20261112000001); absent before that migration, which reads as "race" */
  party_mode?: PartyMode;
  party_leads: string[];
  /** R2-P5 (20261204000301): the host lets anyone with the code watch at /party/<code>/tv; absent before it */
  tv_open?: boolean;
}

export interface PlayerRow {
  match_id: string;
  player_id: string;
  ready: boolean;
  rounds_won: number;
  progress: number;
  mistakes: number;
  finished_ms: number | null;
  place: number | null;
  left_at: string | null;
  last_seen_at: string;
  rating_before: number | null;
  rating_after: number | null;
  seat: number;
  state: unknown;
  points: number;
  spectator: boolean;
  rematch: boolean;
  joined_at: string;
  kicked_at?: string | null;
  /** the Party round this player sat out, if any */
  passed_round?: number | null;
  players: {
    nickname: string;
    avatar_color: string;
    level: number;
    country: string | null;
    city: string | null;
    age_band: string;
    birth_year?: number | null;
    birth_month?: number | null;
  } | null;
}

export interface RoundRow {
  round: number;
  player_id: string;
  game_id: string | null;
  time_ms: number | null;
  mistakes: number;
  progress: number;
  place: number | null;
  points: number;
  won: boolean;
}

export interface Loaded {
  m: MatchRow;
  players: PlayerRow[];
  rounds: RoundRow[];
  now: number;
}

const ms = (s: string | null | undefined) => (s ? Date.parse(s) : null);
const iso = (n: number) => new Date(n).toISOString();
export const sleep = (n: number) => new Promise((r) => setTimeout(r, n));

export async function loadMatch(admin: SupabaseClient, id: string): Promise<Loaded> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "match_not_found");
  const [{ data: m }, { data: players }] = await Promise.all([
    admin.from("matches").select("*").eq("id", id).maybeSingle(),
    admin
      .from("match_players")
      .select("*, players(nickname, avatar_color, level, country, city, age_band, birth_year, birth_month)")
      .eq("match_id", id)
      .order("seat"),
  ]);
  if (!m) throw new ApiError(404, "match_not_found");
  const { data: rounds } = await admin
    .from("match_rounds")
    .select("round, player_id, game_id, time_ms, mistakes, progress, place, points, won")
    .eq("match_id", id)
    .eq("set_no", m.set_no)
    .order("round");
  return {
    m: { ...m, party_leads: m.party_leads ?? [] } as MatchRow,
    players: (players ?? []).map((p) => ({ ...p, progress: Number(p.progress) })) as PlayerRow[],
    rounds: (rounds ?? []).map((r) => ({ ...r, progress: Number(r.progress) })) as RoundRow[],
    now: Date.now(),
  };
}

export function member(l: Loaded, playerId: string): PlayerRow {
  const p = l.players.find((x) => x.player_id === playerId);
  if (!p) throw new ApiError(403, "not_in_match");
  return p;
}

const isStale = (p: PlayerRow, now: number, after: number = TIMING.staleMs) => now - Date.parse(p.last_seen_at) > after;

/** Any request from a player is a heartbeat. A returning player ends a pause; their clock resumes. */
export async function touch(admin: SupabaseClient, l: Loaded, playerId: string) {
  const now = Date.now();
  await admin
    .from("match_players")
    .update({ last_seen_at: iso(now) })
    .eq("match_id", l.m.id)
    .eq("player_id", playerId);
  const me = l.players.find((p) => p.player_id === playerId);
  if (me) me.last_seen_at = iso(now);
  if (l.m.paused_at && l.m.kind === "duel") {
    const others = l.players.filter((p) => !p.left_at && p.player_id !== playerId);
    if (others.every((p) => !isStale(p, now))) {
      const add = now - Date.parse(l.m.paused_at);
      const { data } = await admin
        .from("matches")
        .update({ paused_at: null, pause_ms: l.m.pause_ms + add, updated_at: iso(now) })
        .eq("id", l.m.id)
        .eq("paused_at", l.m.paused_at)
        .select("id");
      if (data?.length) {
        l.m.paused_at = null;
        l.m.pause_ms += add;
        await serverBroadcast(matchTopic(l.m.id), "changed", { reason: "resume" });
      }
    }
  }
}

async function ratingsOf(admin: SupabaseClient, ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const { data } = await admin.from("ratings").select("player_id, rating").eq("track", "duel").in("player_id", ids);
  return Object.fromEntries((data ?? []).map((r) => [r.player_id, Math.round(Number(r.rating))]));
}

/** Rounds that can have a rules break: ranked Duels between people. */
const rulesRound = (m: MatchRow) => m.kind === "duel" && m.rated && !m.is_bot;

/** The client view. The puzzle unlocks when its countdown begins; solutions never leave the server. */
export async function viewOf(admin: SupabaseClient, l: Loaded, me: string, reward: MatchView["reward"] = null): Promise<MatchView> {
  const { m, now } = l;
  // Ratings only show in Duels.
  const ratings =
    m.kind === "duel"
      ? await ratingsOf(
          admin,
          l.players.map((p) => p.player_id),
        )
      : {};
  const start = ms(m.round_started_at);
  let puzzle: MatchView["puzzle"] = null;
  const game = m.games[m.round - 1];
  const adult = isAdultRoom(m);
  const countdownMs = await liveCountdownMs();
  // Before a ranked round's countdown: who is new to its game (their rules card shows; the rival waits).
  let rulesFor: string[] | null = null;
  if (!adult && rulesRound(m) && game && m.status === "playing" && start !== null && now < start - countdownMs) {
    const ids = l.players.filter((p) => !p.spectator).map((p) => p.player_id);
    rulesFor = newToGame(game, ids, await knownGames(admin, ids, [game]));
  }
  if (!adult && m.status === "playing" && start !== null && game && now >= puzzleShowsAt(m.kind, start, countdownMs)) {
    const r = await roundPuzzle(m.id, m.set_no, m.round, game, m.difficulty);
    // A content game's reference goes out as a token good only for this round, for this player.
    puzzle = { round: m.round, game, data: bindPuzzle(r.puzzle, me, { k: "m", m: m.id, s: m.set_no, r: m.round }) };
  }
  const minor = (p: PlayerRow) => !p.players || isUnder16(effectiveBand(p.players));
  const players: MatchPlayerView[] = l.players.map((p) => ({
    id: p.player_id,
    nickname: p.players?.nickname ?? "Spuzler",
    color: p.players?.avatar_color ?? "#B8F23A",
    level: p.players?.level ?? 1,
    country: minor(p) ? null : (p.players?.country ?? null),
    city: minor(p) ? null : (p.players?.city ?? null),
    rating: ratings[p.player_id] ?? 1000,
    seat: p.seat,
    ready: p.ready,
    roundsWon: p.rounds_won,
    points: p.points,
    progress: p.progress,
    mistakes: p.mistakes,
    finishedMs: p.finished_ms,
    place: p.place,
    host: p.player_id === m.host_id,
    spectator: p.spectator,
    left: !!p.left_at,
    stale: !p.left_at && isStale(p, now),
    passed: p.passed_round === m.round,
    rematch: p.rematch,
    ratingBefore: p.rating_before === null ? null : Number(p.rating_before),
    ratingAfter: p.rating_after === null ? null : Number(p.rating_after),
  }));
  const rounds: MatchRoundView[] = l.rounds.map((r) => ({
    round: r.round,
    playerId: r.player_id,
    gameId: r.game_id,
    timeMs: r.time_ms,
    mistakes: r.mistakes,
    place: r.place,
    points: r.points,
    won: r.won,
  }));
  const mine = l.players.find((p) => p.player_id === me);
  // Head-to-head, for duels between two people: shown at the start (versus) and the end, so read only then.
  const rival = l.players.find((p) => p.player_id !== me && !p.spectator);
  const h2h =
    m.kind === "duel" && !m.is_bot && rival && mine && (m.status === "finished" || (m.round === 1 && m.status !== "playing"))
      ? await headToHead(admin, me, rival.player_id)
      : null;
  return {
    h2h,
    id: m.id,
    kind: m.kind,
    status: m.status,
    code: m.code,
    hostId: m.host_id,
    round: m.round,
    bestOf: m.best_of,
    setNo: m.set_no,
    gameId: m.game_id,
    games: m.games,
    chosenGames: m.chosen_games ?? [],
    difficulty: m.difficulty,
    mix: m.mix,
    classroom: m.classroom,
    tvOpen: !!m.tv_open,
    maxPlayers: m.max_players,
    rated: m.rated,
    isBot: m.is_bot,
    roundStartedAt: start,
    countdownMs,
    roundFirstAt: ms(m.round_first_at),
    pausedAt: ms(m.paused_at),
    pauseMs: m.pause_ms,
    winnerId: m.winner_id,
    result: m.result,
    rematchId: m.rematch_id,
    emptiedAt: ms(m.emptied_at),
    serverNow: Date.now(),
    me,
    players,
    rounds,
    bot: m.is_bot ? { name: "Practice bot", roundsWon: m.bot_rounds_won, finishMs: m.bot_ms[m.round - 1] ?? null, times: m.bot_ms } : null,
    puzzle,
    rulesFor,
    myState: mine && puzzle ? mine.state : null,
    // 18+ party rooms: what this player was paid, read back from the ledgers once the room finished.
    reward: reward ?? (adult && m.status === "finished" ? await adultRewardFor(admin, m, me) : null),
    mode: modeOf(m),
    party: adult ? await adultRoundView(admin, l, me) : null,
  };
}

function requirePlaying(l: Loaded, p: PlayerRow, round: number) {
  if (isAdultRoom(l.m)) throw new ApiError(409, "not_a_race");
  if (p.left_at) throw new ApiError(409, "left_match");
  if (p.spectator) throw new ApiError(403, "spectator");
  if (l.m.status !== "playing") throw new ApiError(409, "not_playing");
  if (l.m.round !== round) throw new ApiError(409, "wrong_round");
  // Duel and Party alike: nothing counts before the round's real start (the end of its countdown), whatever the UI shows.
  const start = ms(l.m.round_started_at);
  if (start === null || l.now < start) throw new ApiError(409, "too_early");
}

/* ---------------- Progress (server validated) ---------------- */

/**
 * The round puzzle behind a race token (lib/game/guess-token.ts), for the guess route: only while that round is
 * the match's current round and its puzzle is showing, and only for a racer in it (not a spectator, not gone).
 */
export async function raceRoundPuzzle(
  admin: SupabaseClient,
  playerId: string,
  matchId: string,
  setNo: number,
  round: number,
  game: string,
) {
  const l = await loadMatch(admin, matchId);
  const { m, now } = l;
  const p = member(l, playerId);
  if (p.spectator || p.left_at) throw new ApiError(403, "not_racing");
  const start = ms(m.round_started_at);
  if (isAdultRoom(m) || m.status !== "playing" || start === null || m.set_no !== setNo || m.round !== round || m.games[round - 1] !== game)
    throw new ApiError(409, "round_over");
  // No answers during the countdown, the same rule as moves and finishes (requirePlaying): input never bleeds in early.
  if (now < start) throw new ApiError(409, "too_early");
  return roundPuzzle(m.id, m.set_no, m.round, game, m.difficulty);
}

export async function submitProgress(
  admin: SupabaseClient,
  id: string,
  playerId: string,
  input: { round: number; state: unknown; mistakes: number },
) {
  const l = await loadMatch(admin, id);
  const p = member(l, playerId);
  await touch(admin, l, playerId);
  requirePlaying(l, p, input.round);
  if (p.finished_ms !== null) return { progress: 1, mistakes: p.mistakes };
  if (p.passed_round === input.round) return { progress: p.progress, mistakes: p.mistakes };
  if (l.m.paused_at) return { progress: p.progress, mistakes: p.mistakes, paused: true };
  const game = l.m.games[l.m.round - 1];
  const r = await roundPuzzle(l.m.id, l.m.set_no, l.m.round, game, l.m.difficulty);
  const v = validateProgress(r.logic, r.puzzle, r.solution, { state: input.state, mistakes: input.mistakes }, p.mistakes);
  if (!v.ok) throw new ApiError(422, "invalid_state", v.reason);
  await admin
    .from("match_players")
    .update({ state: input.state, progress: v.progress, mistakes: v.mistakes })
    .eq("match_id", id)
    .eq("player_id", playerId)
    .is("finished_ms", null);
  if (v.progress !== p.progress || v.mistakes !== p.mistakes)
    await serverBroadcast(matchTopic(id), "progress", { player: playerId, progress: v.progress, mistakes: v.mistakes, round: l.m.round });
  return { progress: v.progress, mistakes: v.mistakes };
}

/* ---------------- Finish ---------------- */

export async function submitFinish(
  admin: SupabaseClient,
  id: string,
  playerId: string,
  input: { round: number; state: unknown; mistakes: number },
) {
  const l = await loadMatch(admin, id);
  const p = member(l, playerId);
  await touch(admin, l, playerId);
  requirePlaying(l, p, input.round);
  if (p.passed_round === input.round) throw new ApiError(409, "passed", "You skipped this round.");
  if (l.m.paused_at) throw new ApiError(409, "paused");
  const game = l.m.games[l.m.round - 1];
  const r = await roundPuzzle(l.m.id, l.m.set_no, l.m.round, game, l.m.difficulty);
  let ok = false;
  try {
    ok = r.logic.verify(r.puzzle, r.solution, input.state).ok;
  } catch {
    ok = false;
  }
  if (!ok) throw new ApiError(422, "not_solved");
  const mistakes = Math.max(p.mistakes, Math.min(input.mistakes, p.mistakes + 10));
  await admin.from("match_players").update({ state: input.state, mistakes }).eq("match_id", id).eq("player_id", playerId);
  const { data, error } = await admin.rpc("svc_match_finish", {
    p_match: id,
    p_round: input.round,
    p_player: playerId,
    p_mistakes: mistakes,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { time_ms: number | null; first_ms: number | null; accepted: boolean };
  if (!row?.accepted) throw new ApiError(409, "round_over");
  await serverBroadcast(matchTopic(id), "finish", { player: playerId, timeMs: row.time_ms, round: input.round });
  // Let near-simultaneous finishes land before deciding (same tenth of a second is a tie).
  await sleep(TIMING.settleMs);
  await resolve(admin, id);
  return viewOf(admin, await loadMatch(admin, id), playerId);
}

/**
 * "Skip this round" in a Party Race: the player sits the current round out. The round stops waiting for them, they
 * score 0 for it and place last, and they are back for the next round. Only while the round is running and only
 * before they finish it; not in 18+ party rooms (their own rules) or Duels (leaving is the way out there).
 */
export async function passRound(admin: SupabaseClient, id: string, playerId: string, round: number) {
  const l = await loadMatch(admin, id);
  const p = member(l, playerId);
  await touch(admin, l, playerId);
  if (l.m.kind !== "race" || isAdultRoom(l.m)) throw new ApiError(409, "cannot_pass", "You can only skip rounds in a Party Race.");
  requirePlaying(l, p, round);
  if (l.rounds.some((r) => r.round === round && r.player_id === playerId && r.time_ms !== null))
    throw new ApiError(409, "already_finished", "You already finished this round.");
  if (p.passed_round !== round) {
    const { error } = await admin.from("match_players").update({ passed_round: round }).eq("match_id", id).eq("player_id", playerId);
    if (error) throw error;
    await serverBroadcast(matchTopic(id), "changed", { reason: "pass", player: playerId });
  }
  await resolve(admin, id);
  return viewOf(admin, await loadMatch(admin, id), playerId);
}

/* ---------------- Resolution (idempotent; any request may run it) ---------------- */

/** Settles the current round if it can be. Returns true when something changed. */
export async function resolve(admin: SupabaseClient, id: string, loaded?: Loaded): Promise<boolean> {
  const l = loaded ?? (await loadMatch(admin, id));
  if (l.m.status !== "playing") return false;
  if (l.m.kind === "duel") return resolveDuel(admin, l);
  if (isAdultRoom(l.m)) return resolveAdult(admin, l);
  return resolveRace(admin, l);
}

export async function commit(
  admin: SupabaseClient,
  l: Loaded,
  next: {
    status: string;
    round?: number;
    startAt?: number | null;
    winner?: string | null;
    result?: string | null;
    botRoundsWon?: number | null;
    players?: { player_id: string; rounds_won?: number; points?: number; place?: number }[];
    rounds?: Record<string, unknown>[];
  },
): Promise<boolean> {
  const { data, error } = await admin.rpc("svc_match_commit", {
    p_match: l.m.id,
    p_expect_status: l.m.status,
    p_expect_round: l.m.round,
    p_status: next.status,
    p_round: next.round ?? l.m.round,
    p_round_started_at: next.startAt ? iso(next.startAt) : null,
    p_winner: next.winner ?? null,
    p_result: next.result ?? null,
    p_bot_rounds_won: next.botRoundsWon ?? null,
    p_players: next.players ?? [],
    p_rounds: next.rounds ?? [],
  });
  if (error) throw error;
  return data === true;
}

async function resolveDuel(admin: SupabaseClient, l: Loaded): Promise<boolean> {
  const { m, now } = l;
  const start = ms(m.round_started_at)!;
  if (now < start) return false;
  const humans = l.players.filter((p) => !p.spectator);
  const here = l.rounds.filter((r) => r.round === m.round && r.time_ms !== null);
  const finishers: Finisher[] = here.map((r) => ({ id: r.player_id, timeMs: r.time_ms!, mistakes: r.mistakes }));
  if (m.is_bot) {
    const botMs = m.bot_ms[m.round - 1];
    const effective = now - start - m.pause_ms - (m.paused_at ? now - Date.parse(m.paused_at) : 0);
    if (botMs !== undefined && effective >= botMs) finishers.push({ id: BOT_ID, timeMs: botMs, mistakes: 0 });
  }
  if (!finishers.length) return false;
  // Wait for the settle window after the first finish so a near tie is decided fairly.
  const firstAt = ms(m.round_first_at);
  if (firstAt !== null && now - firstAt < TIMING.settleMs) return false;
  const outcome = resolveRound(finishers);
  const score: Record<string, number> = Object.fromEntries(humans.map((p) => [p.player_id, p.rounds_won]));
  if (m.is_bot) score[BOT_ID] = m.bot_rounds_won;
  if (outcome.winner) score[outcome.winner] = (score[outcome.winner] ?? 0) + 1;
  const state = matchState(score, m.round);
  // A ranked next round of a game new to either player starts after a rules break.
  const ids = humans.map((p) => p.player_id);
  const rulesMs =
    !state.over && rulesRound(m) ? rulesBreakMs(newToGame(m.games[m.round], ids, await knownGames(admin, ids, [m.games[m.round]]))) : 0;
  const rounds = humans.map((p) => {
    const f = finishers.find((x) => x.id === p.player_id);
    return {
      player_id: p.player_id,
      game_id: m.games[m.round - 1],
      time_ms: f?.timeMs ?? null,
      mistakes: f?.mistakes ?? p.mistakes,
      progress: f ? 1 : p.progress,
      place: outcome.winner === p.player_id ? 1 : outcome.winner === null ? 1 : 2,
      points: 0,
      won: outcome.winner === p.player_id,
    };
  });
  const applied = await commit(admin, l, {
    status: state.over ? "finished" : "playing",
    round: state.over ? m.round : m.round + 1,
    startAt: state.over ? null : nextRoundStart(now, (await getGameSettings())["duel.roundResultMs"], await liveCountdownMs()) + rulesMs,
    winner: state.over && state.winner && state.winner !== BOT_ID ? state.winner : null,
    result: state.over ? (state.draw ? "draw" : state.winner === BOT_ID ? "bot" : "win") : null,
    botRoundsWon: m.is_bot ? score[BOT_ID] : null,
    players: humans.map((p) => ({ player_id: p.player_id, rounds_won: score[p.player_id] ?? 0 })),
    rounds,
  });
  if (!applied) return false;
  await serverBroadcast(matchTopic(m.id), "changed", {
    reason: state.over ? "match_end" : "round_end",
    winner: outcome.winner,
    tie: outcome.tie,
  });
  if (state.over) await finalizeDuel(admin, await loadMatch(admin, m.id));
  return true;
}

async function resolveRace(admin: SupabaseClient, l: Loaded): Promise<boolean> {
  const { m, now } = l;
  const start = ms(m.round_started_at)!;
  if (now < start) return false;
  const racers: Racer[] = l.players
    .filter((p) => !p.spectator)
    .map((p) => {
      const r = l.rounds.find((x) => x.round === m.round && x.player_id === p.player_id);
      return {
        id: p.player_id,
        timeMs: r?.time_ms ?? null,
        mistakes: r?.mistakes ?? p.mistakes,
        progress: r?.time_ms != null ? 1 : p.progress,
        gone: !!p.left_at || isStale(p, now, TIMING.reconnectMs),
        passed: p.passed_round === m.round && r?.time_ms == null,
      };
    });
  if (!raceOver(racers, start, ms(m.round_first_at), now)) return false;
  const placed = placeRace(racers);
  const last = m.round >= m.games.length;
  const totals = new Map(l.players.map((p) => [p.player_id, p.points]));
  for (const r of placed) totals.set(r.id, (totals.get(r.id) ?? 0) + r.points);
  const standing = [...totals.entries()]
    .filter(([pid]) => !l.players.find((p) => p.player_id === pid)?.spectator)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const applied = await commit(admin, l, {
    status: last ? "finished" : "round_end",
    winner: last ? (standing[0]?.[0] ?? null) : null,
    result: last ? "win" : null,
    players: standing.map(([pid, pts], i) => ({ player_id: pid, points: pts, place: i + 1 })),
    rounds: placed.map((r) => ({
      player_id: r.id,
      game_id: m.games[m.round - 1],
      time_ms: r.timeMs,
      mistakes: r.mistakes,
      progress: r.progress,
      place: r.place,
      points: r.points,
      won: r.place === 1 && r.timeMs !== null,
    })),
  });
  if (!applied) return false;
  await serverBroadcast(matchTopic(m.id), "changed", { reason: last ? "final" : "podium" });
  if (last) await finalizeRace(admin, await loadMatch(admin, m.id), placed);
  return true;
}

/* ---------------- Tick: time-based transitions any participant can trigger ---------------- */

/** `gate` runs for 18+ party rooms (the age gate), before anything else. */
export async function tick(admin: SupabaseClient, id: string, playerId: string, gate?: () => Promise<unknown>) {
  let l = await loadMatch(admin, id);
  member(l, playerId);
  if (gate && isAdultRoom(l.m)) await gate();
  await touch(admin, l, playerId);
  const { m, now } = l;
  const before = { ...m };
  if (m.status === "playing" && m.kind === "duel" && !m.is_bot) {
    const active = l.players.filter((p) => !p.left_at && !p.spectator);
    const stale = active.filter((p) => isStale(p, now));
    const start = ms(m.round_started_at)!;
    if (stale.length && !m.paused_at && now >= start) {
      const { data } = await admin
        .from("matches")
        .update({ paused_at: iso(now) })
        .eq("id", id)
        .is("paused_at", null)
        .eq("status", "playing")
        .select("id");
      if (data?.length) {
        m.paused_at = iso(now);
        await serverBroadcast(matchTopic(id), "changed", { reason: "pause", player: stale[0].player_id });
      }
    }
    // Gone past the reconnect window: abandoning counts as a loss (SRS 6).
    const gone = stale.filter((p) => now - Date.parse(p.last_seen_at) > TIMING.reconnectMs);
    if (gone.length === 1 && active.length === 2) {
      await forfeit(admin, l, gone[0].player_id, "abandon");
      m.status = "finished";
    }
  }
  // Reuse this request's load unless something changed it.
  let dirty = before.paused_at !== m.paused_at || before.status !== m.status;
  if (dirty) l = await loadMatch(admin, id);
  if (l.m.status === "playing" && l.now >= (ms(l.m.round_started_at) ?? Infinity)) dirty = (await resolve(admin, id, l)) || dirty;
  if (l.m.kind === "race" && l.m.status !== "playing") dirty = (await migrateHostIfGone(admin, l)) || dirty;
  return viewOf(admin, dirty ? await loadMatch(admin, id) : l, playerId);
}

async function forfeit(admin: SupabaseClient, l: Loaded, loser: string, result: "abandon" | "left") {
  const winner = l.players.find((p) => p.player_id !== loser && !p.spectator)?.player_id ?? null;
  const applied = await commit(admin, l, { status: "finished", winner, result });
  if (!applied) return;
  await serverBroadcast(matchTopic(l.m.id), "changed", { reason: result, player: loser });
  await finalizeDuel(admin, await loadMatch(admin, l.m.id));
}

async function migrateHostIfGone(admin: SupabaseClient, l: Loaded): Promise<boolean> {
  const host = l.players.find((p) => p.player_id === l.m.host_id);
  if (host && !host.left_at && !isStale(host, l.now, 30_000)) return false;
  const next = nextHost(
    l.players.map((p) => ({
      id: p.player_id,
      joinedAt: Date.parse(p.joined_at),
      gone: !!p.left_at || isStale(p, l.now, 30_000),
      spectator: p.spectator,
    })),
    l.m.host_id ?? "",
  );
  if (!next || next === l.m.host_id) return false;
  const { data } = await admin.from("matches").update({ host_id: next }).eq("id", l.m.id).eq("host_id", l.m.host_id!).select("id");
  if (!data?.length) return false;
  await serverBroadcast(matchTopic(l.m.id), "changed", { reason: "host", host: next });
  return true;
}

/* ---------------- Leave ---------------- */

export async function leave(admin: SupabaseClient, id: string, playerId: string) {
  const l = await loadMatch(admin, id);
  const p = member(l, playerId);
  if (p.left_at) return { ok: true };
  const now = iso(Date.now());
  await admin.from("match_players").update({ left_at: now, ready: false }).eq("match_id", id).eq("player_id", playerId);
  p.left_at = now;
  const { m } = l;
  if (m.kind === "duel") {
    if (m.status === "playing") await forfeit(admin, l, playerId, "left");
    else if (m.status === "lobby") await admin.from("matches").update({ status: "abandoned", emptied_at: now }).eq("id", id);
    await serverBroadcast(matchTopic(id), "changed", { reason: "left", player: playerId });
    return { ok: true };
  }
  const still = l.players.filter((x) => !x.left_at);
  const patch: Record<string, unknown> = { updated_at: now };
  if (!still.length) patch.emptied_at = now;
  if (m.host_id === playerId) {
    patch.host_id = nextHost(
      l.players.map((x) => ({ id: x.player_id, joinedAt: Date.parse(x.joined_at), gone: !!x.left_at, spectator: x.spectator })),
      playerId,
    );
  }
  await admin.from("matches").update(patch).eq("id", id);
  await serverBroadcast(matchTopic(id), "changed", { reason: "left", player: playerId, host: patch.host_id ?? m.host_id });
  if (m.status === "playing") await resolve(admin, id);
  return { ok: true };
}
