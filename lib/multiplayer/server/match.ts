import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { TIMING } from "../constants";
import { BOT_ID, matchState, nextRoundStart, resolveRound, type Finisher } from "../duel";
import { placeRace, raceOver, nextHost, type Racer } from "../race";
import { validateProgress } from "../progress";
import type { MatchPlayerView, MatchRoundView, MatchView } from "../types";
import { roundPuzzle } from "./puzzles";
import { finalizeDuel, finalizeRace } from "./rewards";

export const matchTopic = (id: string) => `match:${id}`;

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
  players: { nickname: string; avatar_color: string; level: number; country: string | null; city: string | null; age_band: string } | null;
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
      .select("*, players(nickname, avatar_color, level, country, city, age_band)")
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
    m: m as MatchRow,
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
  if (m.status === "playing" && start !== null && game && now >= start - TIMING.countdownMs) {
    const r = await roundPuzzle(m.id, m.set_no, m.round, game, m.difficulty);
    puzzle = { round: m.round, game, data: r.puzzle };
  }
  const minor = (p: PlayerRow) => p.players?.age_band === "13-15";
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
  return {
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
    difficulty: m.difficulty,
    mix: m.mix,
    classroom: m.classroom,
    maxPlayers: m.max_players,
    rated: m.rated,
    isBot: m.is_bot,
    roundStartedAt: start,
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
    myState: mine && puzzle ? mine.state : null,
    reward,
  };
}

function requirePlaying(l: Loaded, p: PlayerRow, round: number) {
  if (p.left_at) throw new ApiError(409, "left_match");
  if (p.spectator) throw new ApiError(403, "spectator");
  if (l.m.status !== "playing") throw new ApiError(409, "not_playing");
  if (l.m.round !== round) throw new ApiError(409, "wrong_round");
  const start = ms(l.m.round_started_at)!;
  if (l.now < start) throw new ApiError(409, "too_early");
}

/* ---------------- Progress (server validated) ---------------- */

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

/* ---------------- Resolution (idempotent; any request may run it) ---------------- */

/** Settles the current round if it can be. Returns true when something changed. */
export async function resolve(admin: SupabaseClient, id: string, loaded?: Loaded): Promise<boolean> {
  const l = loaded ?? (await loadMatch(admin, id));
  if (l.m.status !== "playing") return false;
  if (l.m.kind === "duel") return resolveDuel(admin, l);
  return resolveRace(admin, l);
}

async function commit(
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
    startAt: state.over ? null : nextRoundStart(now),
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

export async function tick(admin: SupabaseClient, id: string, playerId: string) {
  let l = await loadMatch(admin, id);
  member(l, playerId);
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
