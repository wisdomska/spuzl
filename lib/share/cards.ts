import "server-only";
import { duelShareModel, type DuelShareModel } from "./duel-card";
import { headToHead } from "@/lib/multiplayer/server/h2h";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_BY_ID, LAUNCH_IDS, toneOf } from "@/lib/catalog";
import { dailyNumber } from "@/lib/format";
import { dailyCard, duelCard, freeCard, fullCard, partyCard, type CardModel } from "./card-model";

/**
 * Share card loaders. Every number on a card comes from the database by attempt or match id;
 * the query string only picks the frame. Ids are unguessable UUIDs, so cards can be public
 * (link previews fetch them without a session) without exposing anything the boards don't.
 * Returns null when there is nothing honest to show: unknown id, not cleared, flagged, unfinished.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

interface AttemptRow {
  id: string;
  player_id: string;
  game_id: string;
  mode: string;
  daily_date: string | null;
  status: string;
  verified: boolean;
  time_ms: number | null;
  hints: number;
  deaths: number;
  score: number | null;
}

async function streakAndLevel(admin: SupabaseClient, playerId: string) {
  const [{ data: s }, { data: p }] = await Promise.all([
    admin.from("streaks").select("current").eq("player_id", playerId).maybeSingle(),
    admin.from("players").select("level").eq("id", playerId).maybeSingle(),
  ]);
  return { streak: s?.current ?? 0, level: p?.level ?? 1 };
}

/**
 * A clear's card: "daily" (a Daily or archive clear), "full" (the day's Full Spuzl) or "free" (R4-20: a free-play
 * clear, the share image while story cards are off). Only verified clears of the matching mode render.
 */
export async function attemptCard(admin: SupabaseClient, id: string, kind: "daily" | "full" | "free"): Promise<CardModel | null> {
  if (!isUuid(id)) return null;
  const { data } = await admin
    .from("attempts")
    .select("id, player_id, game_id, mode, daily_date, status, verified, time_ms, hints, deaths, score")
    .eq("id", id)
    .maybeSingle();
  const a = data as AttemptRow | null;
  if (!a || a.status !== "cleared" || !a.verified || a.time_ms === null) return null;
  const meta = GAME_BY_ID[a.game_id];
  if (!meta) return null;
  if (kind === "free") {
    if (a.mode !== "free") return null;
    const { streak, level } = await streakAndLevel(admin, a.player_id);
    return freeCard({
      world: toneOf(meta),
      gameName: meta.name,
      scoring: meta.scoring,
      timeMs: a.time_ms,
      score: a.score,
      hints: a.hints,
      deaths: a.deaths,
      streak,
      level,
    });
  }
  if (!a.daily_date || (a.mode !== "daily" && a.mode !== "archive")) return null;
  const { streak, level } = await streakAndLevel(admin, a.player_id);

  if (kind === "full") {
    if (a.mode !== "daily") return null;
    const { data: rows } = await admin
      .from("daily_results")
      .select("game_id, time_ms")
      .eq("player_id", a.player_id)
      .eq("date", a.daily_date)
      .in("game_id", LAUNCH_IDS);
    if ((rows?.length ?? 0) < LAUNCH_IDS.length) return null;
    const totalMs = rows!.reduce((s, r) => s + (r.time_ms ?? 0), 0);
    return fullCard({ date: a.daily_date, cleared: rows!.length, totalMs, streak, level });
  }

  let percentile: number | null = null;
  let field = 0;
  if (a.mode === "daily") {
    const [{ count }, { data: pct }] = await Promise.all([
      admin.from("daily_results").select("player_id", { count: "exact", head: true }).eq("game_id", a.game_id).eq("date", a.daily_date),
      admin.rpc("svc_daily_percentile", { p_game: a.game_id, p_date: a.daily_date, p_time: a.time_ms }),
    ]);
    field = count ?? 0;
    percentile = pct === null || pct === undefined ? null : Number(pct);
  }
  return dailyCard({
    world: toneOf(meta),
    gameName: meta.name,
    number: dailyNumber(a.daily_date),
    scoring: meta.scoring,
    timeMs: a.time_ms,
    score: a.score,
    hints: a.hints,
    deaths: a.deaths,
    percentile,
    field,
    streak: a.mode === "daily" ? streak : 0,
  });
}

interface MatchPlayerRow {
  player_id: string;
  rounds_won: number;
  place: number | null;
  rating_before: number | string | null;
  rating_after: number | string | null;
}

const num = (v: number | string | null) => (v === null || v === undefined ? null : Number(v));

/**
 * Duel win (always from the winner's side) or Party podium (`playerId` picks whose place to show,
 * defaulting to the winner).
 */
export async function matchCard(admin: SupabaseClient, id: string, playerId?: string | null): Promise<CardModel | null> {
  if (!isUuid(id)) return null;
  const { data: m } = await admin
    .from("matches")
    .select("id, kind, code, game_id, status, round, best_of, winner_id")
    .eq("id", id)
    .maybeSingle();
  if (!m || m.status !== "finished" || !m.winner_id) return null;
  const { data: mp } = await admin
    .from("match_players")
    .select("player_id, rounds_won, place, rating_before, rating_after")
    .eq("match_id", id);
  const seats = (mp ?? []) as MatchPlayerRow[];
  if (seats.length < 2) return null;
  const { data: names } = await admin
    .from("players")
    .select("id, nickname")
    .in(
      "id",
      seats.map((s) => s.player_id),
    );
  const nick = (pid: string) => (names ?? []).find((n) => n.id === pid)?.nickname ?? "a Spuzler";
  const gameName = m.game_id ? (GAME_BY_ID[m.game_id]?.name ?? "Mix") : "Mix";

  if (m.kind === "duel") {
    const w = seats.find((s) => s.player_id === m.winner_id);
    const l = seats.find((s) => s.player_id !== m.winner_id);
    if (!w || !l) return null;
    return duelCard({
      gameName,
      winnerRounds: w.rounds_won,
      loserRounds: l.rounds_won,
      loser: nick(l.player_id),
      ratingBefore: num(w.rating_before),
      ratingAfter: num(w.rating_after),
      bestOf: m.best_of,
    });
  }
  if (m.kind === "race") {
    const me = seats.find((s) => s.player_id === (playerId && isUuid(playerId) ? playerId : m.winner_id));
    if (!me) return null;
    const place = me.place ?? (me.player_id === m.winner_id ? 1 : null);
    if (!place) return null;
    return partyCard({ players: seats.length, place, winner: nick(m.winner_id), games: m.round, code: m.code });
  }
  return null;
}

/**
 * Duel card from one player's side (`playerId`, default the winner), SPIL style: banner, both players, score,
 * rounds, award, rating change and the head-to-head. `anon` hides both names. Finished duels only.
 */
export async function duelShare(admin: SupabaseClient, id: string, playerId?: string | null, anon = false): Promise<DuelShareModel | null> {
  if (!isUuid(id)) return null;
  const { data: m } = await admin
    .from("matches")
    .select("id, kind, game_id, games, status, winner_id, result, set_no, is_bot")
    .eq("id", id)
    .maybeSingle();
  if (!m || m.kind !== "duel" || m.status !== "finished" || m.is_bot) return null;
  const { data: mp } = await admin
    .from("match_players")
    .select("player_id, rounds_won, rating_before, rating_after, spectator, players(nickname, avatar_color)")
    .eq("match_id", id);
  const seats = (
    (mp ?? []) as unknown as {
      player_id: string;
      rounds_won: number;
      rating_before: number | string | null;
      rating_after: number | string | null;
      spectator: boolean;
      players: { nickname: string; avatar_color: string } | null;
    }[]
  ).filter((s) => !s.spectator);
  if (seats.length !== 2) return null;
  const meId = playerId && isUuid(playerId) && seats.some((s) => s.player_id === playerId) ? playerId : (m.winner_id ?? seats[0].player_id);
  const me = seats.find((s) => s.player_id === meId)!;
  const them = seats.find((s) => s.player_id !== meId)!;
  const { data: rr } = await admin
    .from("match_rounds")
    .select("round, player_id, time_ms, won")
    .eq("match_id", id)
    .eq("set_no", m.set_no ?? 1)
    .order("round");
  const rows = (rr ?? []) as { round: number; player_id: string; time_ms: number | null; won: boolean }[];
  const nums = [...new Set(rows.map((r) => r.round))].sort((a, b) => a - b);
  const rounds = nums.map((n) => {
    const a = rows.find((r) => r.round === n && r.player_id === me.player_id);
    const b = rows.find((r) => r.round === n && r.player_id === them.player_id);
    return { n, me: a?.time_ms ?? null, them: b?.time_ms ?? null, mine: a?.won ? true : b?.won ? false : null };
  });
  const h = await headToHead(admin, me.player_id, them.player_id);
  const game = (m.game_id as string | null) ?? (m.games as string[] | null)?.[0] ?? null;
  return duelShareModel({
    me: { name: me.players?.nickname ?? "Spuzler", color: me.players?.avatar_color ?? "#B8F23A", rounds: me.rounds_won },
    them: { name: them.players?.nickname ?? "Spuzler", color: them.players?.avatar_color ?? "#FF8A3D", rounds: them.rounds_won },
    winner: m.winner_id === me.player_id ? "me" : m.winner_id === them.player_id ? "them" : null,
    forfeit: m.result === "abandon" || m.result === "left",
    gameName: game ? (GAME_BY_ID[game]?.name ?? "Mix") : "Mix",
    rounds,
    ratingBefore: num(me.rating_before),
    ratingAfter: num(me.rating_after),
    anon,
    h2h: { me: h.me, them: h.them },
  });
}
