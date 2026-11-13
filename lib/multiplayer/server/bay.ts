import "server-only";
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { pushTo } from "@/lib/push/server";
import { GAME_BY_ID } from "@/lib/catalog";
import { createRng } from "@/lib/rng";
import { TIMING } from "../constants";
import {
  LIVE_CLOCK_MS,
  clockMsFor,
  asyncDeadline,
  canNudge,
  flagFallen,
  initialState,
  isBayGame,
  loadRules,
  replayMoves,
  spendClock,
  takebackPlies,
  validateMove,
  type BayRulesGame,
} from "../bay";
import { CODE_ALPHABET, makeRoomCode } from "../roomCode";
import type { BayView } from "../types";
import { rateTwo } from "./rewards";
import { requireBayJoin } from "./joinRequests";
import { openGameNow } from "@/lib/game-settings/server";

/**
 * A board game a new match, a join or a rematch may use now: On (or In testing, for a signed-in admin trying it),
 * per the Games page. Off, and In testing for players, answer like an unknown game.
 */
export async function requireBayOpen(game: string) {
  if (!(await openGameNow(game))) throw new ApiError(404, "unknown_game");
}

export const bayTopic = (id: string) => `bay:${id}`;
const iso = (n: number) => new Date(n).toISOString();
const ms = (s: string | null) => (s ? Date.parse(s) : null);
/** The Practice bot's seat is a null-free placeholder: it never owns a player row. */
export const BOT_PLAYER = "00000000-0000-0000-0000-000000000000";

interface BayRow {
  id: string;
  game_id: BayRulesGame;
  mode: "live" | "async";
  status: BayView["status"];
  players: string[];
  turn: number;
  state: unknown;
  move_deadline: string | null;
  nudged_at: string | null;
  result: string | null;
  winner_id: string | null;
  invite_code: string | null;
  seats: number;
  rated: boolean;
  bot: boolean;
  ply: number;
  seed: string;
  clock_ms: number[] | null;
  /** live: the time control each player started with (null on matches from before time controls: 5 min) */
  clock_base_ms: number | null;
  turn_started_at: string | null;
  draw_offer: number | null;
  takeback_offer: number | null;
  rematch_id: string | null;
  created_by: string | null;
  updated_at: string;
}

async function load(admin: SupabaseClient, id: string): Promise<BayRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "match_not_found");
  const { data } = await admin.from("board_matches").select("*").eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "match_not_found");
  return data as BayRow;
}

const seatOf = (b: BayRow, player: string) => b.players.indexOf(player);

async function movesOf(admin: SupabaseClient, b: BayRow) {
  const { data } = await admin.from("board_moves").select("ply, player_id, move").eq("match_id", b.id).order("ply");
  // Stored as { s: seat, m: move } so Practice bot plies keep their own seat.
  return (data ?? []).map((r) => {
    const x = r.move as { s: number; m: unknown };
    return { ply: r.ply as number, seat: x.s, move: x.m, player: r.player_id as string };
  });
}

export async function bayView(admin: SupabaseClient, b: BayRow, me: string): Promise<BayView> {
  const humans = b.players.filter((p) => p !== BOT_PLAYER);
  const [{ data: cards }, { data: ratings }, moves] = await Promise.all([
    admin
      .from("players")
      .select("id, nickname, avatar_color, hat:owned_hat")
      .in("id", humans.length ? humans : [BOT_PLAYER]),
    admin
      .from("ratings")
      .select("player_id, rating")
      .eq("track", `board:${b.game_id}`)
      .in("player_id", humans.length ? humans : [BOT_PLAYER]),
    movesOf(admin, b),
  ]);
  const seat = seatOf(b, me);
  return {
    id: b.id,
    game: b.game_id,
    mode: b.mode,
    status: b.status,
    seats: b.seats,
    rated: b.rated,
    bot: b.bot,
    ply: b.ply,
    turn: b.turn,
    state: b.state,
    players: b.players.map((id, i) => {
      const c = cards?.find((x) => x.id === id);
      return {
        id,
        nickname: id === BOT_PLAYER ? "Spuzl" : (c?.nickname ?? "Spuzler"),
        color: id === BOT_PLAYER ? "#A2A6C2" : (c?.avatar_color ?? "#B8F23A"),
        hat: id === BOT_PLAYER ? null : ((c?.hat as string | null | undefined) ?? null),
        rating: Math.round(Number(ratings?.find((r) => r.player_id === id)?.rating ?? 1000)),
        seat: i,
      };
    }),
    mySeat: seat >= 0 ? seat : null,
    inviteCode: seat >= 0 ? b.invite_code : null,
    clockMs: b.clock_ms,
    clockBaseMs: b.mode === "live" ? (b.clock_base_ms ?? LIVE_CLOCK_MS) : null,
    turnStartedAt: ms(b.turn_started_at),
    moveDeadline: ms(b.move_deadline),
    nudgedAt: ms(b.nudged_at),
    drawOffer: b.draw_offer,
    takebackOffer: b.takeback_offer,
    result: b.result,
    winnerId: b.winner_id,
    rematchId: b.rematch_id,
    moves: moves.map(({ ply, seat: s, move }) => ({ ply, seat: s, move })),
    serverNow: Date.now(),
  };
}

export async function getBay(admin: SupabaseClient, id: string, me: string) {
  let b = await load(admin, id);
  if (seatOf(b, me) < 0 && b.status !== "waiting") throw new ApiError(403, "not_in_match");
  b = await settleClock(admin, b);
  return bayView(admin, b, me);
}

/* ---------------- Create, join ---------------- */

export async function createBay(
  admin: SupabaseClient,
  me: string,
  input: {
    game: string;
    mode: "live" | "async";
    seats?: number;
    rated?: boolean;
    bot?: boolean;
    minutes?: number;
    /** Ludo house rules chosen before the match */
    ludo?: { backKick?: boolean; sideKick?: boolean; homeKick?: boolean };
  },
) {
  if (!isBayGame(input.game)) throw new ApiError(400, "not_board_game");
  await requireBayOpen(input.game);
  const rules = await loadRules(input.game);
  const seats = Math.max(rules.seats.min, Math.min(rules.seats.max, input.seats ?? rules.seats.min));
  if (input.bot && !rules.botMove) throw new ApiError(400, "no_bot");
  const seed = crypto.randomUUID();
  const base = initialState(rules, seats, seed);
  // Ludo house rules ride in the match state, so every move is checked against them on the server
  const opts = input.game === "ludo" && input.ludo ? Object.fromEntries(Object.entries(input.ludo).filter(([, v]) => v)) : null;
  const state = opts && Object.keys(opts).length ? { ...(base as object), opts } : base;
  const bot = !!input.bot;
  const clock = input.mode === "live" ? clockMsFor(input.game, input.minutes) : null;
  const players = bot ? [me, ...Array.from({ length: seats - 1 }, () => BOT_PLAYER)] : [me];
  const now = Date.now();
  for (let i = 0; i < 12; i++) {
    const code = bot ? null : makeRoomCode(() => randomInt(0, CODE_ALPHABET.length) / CODE_ALPHABET.length);
    const { data, error } = await admin
      .from("board_matches")
      .insert({
        game_id: input.game,
        mode: input.mode,
        status: bot ? "active" : "waiting",
        players,
        seats,
        turn: rules.turn(state),
        state,
        seed,
        invite_code: code,
        rated: !bot && !!input.rated,
        bot,
        created_by: me,
        clock_ms: clock ? Array.from({ length: seats }, () => clock) : null,
        clock_base_ms: clock,
        turn_started_at: bot ? iso(now) : null,
        move_deadline: bot && input.mode === "async" ? asyncDeadline(now) : null,
      })
      .select("*")
      .single();
    if (!error) return bayView(admin, data as BayRow, me);
    if (error.code !== "23505") throw error;
  }
  throw new ApiError(503, "no_code");
}

export async function joinBay(admin: SupabaseClient, me: string, id: string, code: string) {
  const b = await load(admin, id);
  if (seatOf(b, me) >= 0) return bayView(admin, b, me);
  if (b.status !== "waiting" || !b.invite_code || b.invite_code !== code.toUpperCase()) throw new ApiError(409, "invite_closed");
  await requireBayOpen(b.game_id);
  // R4-02: an under-16 host's invite is friends only (like Party rooms, R2-13).
  await requireBayJoin(admin, b.created_by ?? b.players[0] ?? null, me);
  const players = [...b.players, me];
  const full = players.length >= b.seats;
  const now = Date.now();
  const { data } = await admin
    .from("board_matches")
    .update({
      players,
      status: full ? "active" : "waiting",
      turn_started_at: full ? iso(now) : null,
      move_deadline: full && b.mode === "async" ? asyncDeadline(now) : null,
      updated_at: iso(now),
    })
    .eq("id", id)
    .eq("status", "waiting")
    .eq("updated_at", b.updated_at)
    .select("*");
  if (!data?.length) throw new ApiError(409, "invite_closed");
  await serverBroadcast(bayTopic(id), "changed", { reason: "join" });
  // the game just started: the first mover may be waiting on another screen
  if (full) {
    const started = data[0] as BayRow;
    const first = (await loadRules(started.game_id)).turn(started.state);
    if (started.players[first] !== me) await alertTurn(admin, started, first);
  }
  return bayView(admin, data[0] as BayRow, me);
}

/* ---------------- Moves (server-validated) ---------------- */

async function finishRating(admin: SupabaseClient, b: BayRow, winner: string | null) {
  if (!b.rated || b.seats !== 2 || b.bot) return;
  const [a, c] = b.players;
  await rateTwo(admin, a, c, winner === a ? 1 : winner === c ? 0 : 0.5, `board:${b.game_id}`);
}

export async function makeMove(admin: SupabaseClient, me: string, id: string, input: { ply: number; move: unknown }) {
  let b = await load(admin, id);
  const seat = seatOf(b, me);
  if (seat < 0) throw new ApiError(403, "not_in_match");
  if (b.status !== "active") throw new ApiError(409, "not_active");
  b = await settleClock(admin, b);
  if (b.status !== "active") throw new ApiError(409, "flag_fell");
  if (input.ply !== b.ply) throw new ApiError(409, "stale_ply");
  const rules = await loadRules(b.game_id);
  const v = validateMove(rules, b.state, seat, input.move, b.seed, b.ply);
  if (!v.ok) throw new ApiError(422, v.reason === "not_your_turn" ? "not_your_turn" : "illegal_move", v.reason);
  await commitMove(admin, b, seat, me, input.move, v.next, v.status!);
  await botReply(admin, id);
  return getBay(admin, id, me);
}

async function commitMove(
  admin: SupabaseClient,
  b: BayRow,
  seat: number,
  player: string,
  move: unknown,
  next: unknown,
  status: { over: boolean; winner: number | null; reason?: string },
) {
  const rules = await loadRules(b.game_id);
  const now = Date.now();
  const clock = b.clock_ms && b.turn_started_at ? spendClock(b.clock_ms, seat, now - Date.parse(b.turn_started_at)) : b.clock_ms;
  const winner = status.over && status.winner !== null ? b.players[status.winner] : null;
  const { data: ok, error } = await admin.rpc("svc_bay_commit", {
    p_match: b.id,
    p_ply: b.ply,
    p_player: player === BOT_PLAYER ? b.created_by : player,
    p_move: { s: seat, m: move },
    p_state: next,
    p_turn: rules.turn(next),
    p_status: status.over ? "finished" : "active",
    p_winner: winner === BOT_PLAYER ? null : winner,
    p_result: status.over ? (status.reason ?? (status.winner === null ? "draw" : "win")) : null,
    p_deadline: !status.over && b.mode === "async" ? asyncDeadline(now) : null,
    p_clock: clock,
  });
  if (error) throw error;
  if (!ok) throw new ApiError(409, "stale_ply");
  if (status.over) await finishRating(admin, b, winner);
  await serverBroadcast(bayTopic(b.id), "move", { ply: b.ply, seat, move });
  // The turn passed to someone else: tell them, wherever they are in the app (and in a background tab).
  const nextSeat = rules.turn(next);
  if (!status.over && nextSeat !== seat) await alertTurn(admin, b, nextSeat);
}

/**
 * "Your turn" on a player's own channel (user:<id>, for an open app) and as a push notification (for a closed one;
 * the service worker drops it when SPUZL is on screen). Never to the Practice bot.
 */
async function alertTurn(admin: SupabaseClient, b: BayRow, seat: number) {
  const to = b.players[seat];
  if (!to || to === BOT_PLAYER) return;
  await serverBroadcast(`user:${to}`, "your_turn", { matchId: b.id, game: b.game_id, mode: b.mode });
  await pushTo(admin, to, {
    title: "Your turn",
    body: `It's your move in ${GAME_BY_ID[b.game_id]?.name ?? "your game"}.`,
    url: `/bay/${b.id}`,
    tag: `turn:${b.id}`,
  });
}

/** Practice bot replies straight away (several plies for Ludo rolls and moves). */
async function botReply(admin: SupabaseClient, id: string) {
  for (let i = 0; i < 12; i++) {
    const b = await load(admin, id);
    if (!b.bot || b.status !== "active") return;
    const seat = b.turn;
    if (b.players[seat] !== BOT_PLAYER) return;
    const rules = await loadRules(b.game_id);
    const move = rules.botMove!(b.state, seat, createRng(`${b.seed}:bot:${b.ply}`));
    const v = validateMove(rules, b.state, seat, move, b.seed, b.ply);
    if (!v.ok) return;
    await commitMove(admin, b, seat, BOT_PLAYER, move, v.next, v.status!);
  }
}

/** Live: a fallen flag loses on time. Async: a missed 24 h deadline loses. */
async function settleClock(admin: SupabaseClient, b: BayRow): Promise<BayRow> {
  if (b.status !== "active") return b;
  const now = Date.now();
  const flag = b.mode === "live" && b.turn_started_at && flagFallen(b.clock_ms, b.turn, Date.parse(b.turn_started_at), now);
  const late = b.mode === "async" && b.move_deadline && Date.parse(b.move_deadline) < now;
  if (!flag && !late) return b;
  const winner = b.seats === 2 ? b.players[1 - b.turn] : null;
  const clock = flag && b.clock_ms ? b.clock_ms.map((c, i) => (i === b.turn ? 0 : c)) : b.clock_ms;
  const { data } = await admin
    .from("board_matches")
    .update({
      status: "finished",
      result: flag ? "flag" : "timeout",
      winner_id: winner === BOT_PLAYER ? null : winner,
      clock_ms: clock,
      updated_at: iso(now),
    })
    .eq("id", b.id)
    .eq("status", "active")
    .eq("ply", b.ply)
    .select("*");
  if (!data?.length) return load(admin, b.id);
  await finishRating(admin, b, winner);
  await serverBroadcast(bayTopic(b.id), "changed", { reason: flag ? "flag" : "timeout" });
  return data[0] as BayRow;
}

/* ---------------- Resign, draw, takeback, nudge, rematch ---------------- */

export type BayAction =
  | "resign"
  | "draw_offer"
  | "draw_accept"
  | "draw_decline"
  | "draw_withdraw"
  | "takeback_request"
  | "takeback_accept"
  | "takeback_decline"
  | "nudge"
  | "rematch";

export async function bayAction(admin: SupabaseClient, me: string, id: string, action: BayAction) {
  let b = await load(admin, id);
  const seat = seatOf(b, me);
  if (seat < 0) throw new ApiError(403, "not_in_match");
  b = await settleClock(admin, b);
  const now = Date.now();
  const end = async (winner: string | null, result: string) => {
    const { data } = await admin
      .from("board_matches")
      .update({
        status: "finished",
        winner_id: winner === BOT_PLAYER ? null : winner,
        result,
        draw_offer: null,
        takeback_offer: null,
        updated_at: iso(now),
      })
      .eq("id", id)
      .eq("status", "active")
      .select("id");
    if (data?.length) await finishRating(admin, b, winner);
  };
  const active = () => {
    if (b.status !== "active") throw new ApiError(409, "not_active");
  };
  switch (action) {
    case "resign":
      if (b.status === "waiting") {
        await admin.from("board_matches").update({ status: "abandoned" }).eq("id", id);
        break;
      }
      active();
      await end(b.seats === 2 ? b.players[1 - seat] : null, "resign");
      break;
    case "draw_offer":
      active();
      if (b.bot) {
        await end(null, "agreed draw");
        break;
      }
      await admin.from("board_matches").update({ draw_offer: seat }).eq("id", id);
      break;
    case "draw_accept":
      active();
      if (b.draw_offer === null || b.draw_offer === seat) throw new ApiError(409, "no_offer");
      await end(null, "agreed draw");
      break;
    case "draw_withdraw": {
      // Only your own pending offer, and only if it is still standing (an accept may have just ended the game).
      active();
      if (b.draw_offer !== seat) throw new ApiError(409, "no_offer");
      await admin.from("board_matches").update({ draw_offer: null }).eq("id", id).eq("draw_offer", seat);
      break;
    }
    case "draw_decline":
      await admin.from("board_matches").update({ draw_offer: null }).eq("id", id);
      break;
    case "takeback_request":
      active();
      if (b.rated) throw new ApiError(403, "ranked_no_takebacks", "Takebacks are for unranked friend games.");
      if (b.game_id === "ludo") throw new ApiError(403, "no_takebacks");
      if (b.bot) {
        await takeback(admin, b, seat);
        break;
      }
      await admin.from("board_matches").update({ takeback_offer: seat }).eq("id", id);
      break;
    case "takeback_accept":
      active();
      if (b.takeback_offer === null || b.takeback_offer === seat) throw new ApiError(409, "no_offer");
      await takeback(admin, b, b.takeback_offer);
      break;
    case "takeback_decline":
      await admin.from("board_matches").update({ takeback_offer: null }).eq("id", id);
      break;
    case "nudge": {
      active();
      if (b.mode !== "async") throw new ApiError(409, "live_match");
      const ok = canNudge(
        { myTurn: b.turn === seat, turnStartedAt: Date.parse(b.turn_started_at ?? b.updated_at), nudgedAt: ms(b.nudged_at) },
        now,
      );
      if (!ok) throw new ApiError(409, "nudge_not_yet", "You can nudge 12 h after their turn began, once.");
      await admin
        .from("board_matches")
        .update({ nudged_at: iso(now) })
        .eq("id", id);
      const other = b.players[b.turn];
      if (other && other !== BOT_PLAYER) {
        await serverBroadcast(`user:${other}`, "nudge", { matchId: id, game: b.game_id });
        await pushTo(admin, other, {
          title: "Nudge",
          body: `Your rival is waiting on your move in ${GAME_BY_ID[b.game_id]?.name ?? "your game"}.`,
          url: `/bay/${id}`,
          tag: `turn:${id}`,
        });
      }
      break;
    }
    case "rematch":
      return rematchBay(admin, me, b);
  }
  await serverBroadcast(bayTopic(id), "changed", { reason: action, seat });
  return getBay(admin, id, me);
}

async function takeback(admin: SupabaseClient, b: BayRow, requester: number) {
  const moves = await movesOf(admin, b);
  const n = takebackPlies(moves, requester);
  if (!n) throw new ApiError(409, "nothing_to_take_back");
  const rules = await loadRules(b.game_id);
  const to = moves.length - n;
  const state = replayMoves(rules, b.seats, b.seed, moves, to);
  const { data: ok } = await admin.rpc("svc_bay_rewind", {
    p_match: b.id,
    p_from_ply: b.ply,
    p_to_ply: to,
    p_state: state,
    p_turn: rules.turn(state),
    p_deadline: b.mode === "async" ? asyncDeadline(Date.now()) : null,
  });
  if (!ok) throw new ApiError(409, "stale_ply");
}

async function rematchBay(admin: SupabaseClient, me: string, b: BayRow) {
  if (b.status !== "finished") throw new ApiError(409, "not_finished");
  if (b.rematch_id) return getBay(admin, b.rematch_id, me);
  // A retired game (Flip) can finish, but never starts again.
  if (!isBayGame(b.game_id)) throw new ApiError(409, "game_retired", "This game has left Board Bay.");
  await requireBayOpen(b.game_id);
  const rules = await loadRules(b.game_id);
  const seed = crypto.randomUUID();
  const fresh = initialState(rules, b.seats, seed);
  // a rematch keeps the house rules the players chose (Ludo)
  const kept = (b.state as { opts?: object } | null)?.opts;
  const state = kept ? { ...(fresh as object), opts: kept } : fresh;
  // Seats rotate so the other side moves first.
  const players = [...b.players.slice(1), b.players[0]];
  const now = Date.now();
  const { data, error } = await admin
    .from("board_matches")
    .insert({
      game_id: b.game_id,
      mode: b.mode,
      status: "active",
      players,
      seats: b.seats,
      turn: rules.turn(state),
      state,
      seed,
      rated: b.rated,
      bot: b.bot,
      created_by: me,
      clock_ms: b.mode === "live" ? Array.from({ length: b.seats }, () => b.clock_base_ms ?? LIVE_CLOCK_MS) : null,
      clock_base_ms: b.mode === "live" ? (b.clock_base_ms ?? LIVE_CLOCK_MS) : null,
      turn_started_at: iso(now),
      move_deadline: b.mode === "async" ? asyncDeadline(now) : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: set } = await admin
    .from("board_matches")
    .update({ rematch_id: data.id })
    .eq("id", b.id)
    .is("rematch_id", null)
    .select("id");
  if (!set?.length) {
    await admin.from("board_matches").delete().eq("id", data.id);
    return getBay(admin, (await load(admin, b.id)).rematch_id!, me);
  }
  await serverBroadcast(bayTopic(b.id), "changed", { reason: "rematch", matchId: data.id });
  await botReply(admin, data.id);
  return getBay(admin, data.id, me);
}

/* ---------------- Inbox (Board Games B7) ---------------- */

export async function inbox(admin: SupabaseClient, me: string) {
  const { data } = await admin
    .from("board_matches")
    .select("*")
    .contains("players", [me])
    .order("updated_at", { ascending: false })
    .limit(40);
  const rows = (data ?? []) as BayRow[];
  const now = Date.now();
  const others = [...new Set(rows.flatMap((b) => b.players).filter((p) => p !== me && p !== BOT_PLAYER))];
  const { data: cards } = await admin
    .from("players")
    // R4-H: hat:owned_hat is the worn hat only if the player owns it (migration 20261210720101).
    .select("id, nickname, avatar_color, hat:owned_hat")
    .in("id", others.length ? others : [BOT_PLAYER]);
  const name = (id: string) => (id === BOT_PLAYER ? "Spuzl" : (cards?.find((c) => c.id === id)?.nickname ?? "Spuzler"));
  const color = (id: string) => (id === BOT_PLAYER ? "#A2A6C2" : (cards?.find((c) => c.id === id)?.avatar_color ?? "#B8F23A"));
  const hours = (n: number) => Math.max(0, Math.floor(n / 3_600_000));
  return (
    rows
      // A "waiting" row with no invite code is a Play live pairing being set up: not an invite to list.
      .filter((b) => b.status !== "abandoned" && !(b.status === "finished" && b.rematch_id) && !(b.status === "waiting" && !b.invite_code))
      .slice(0, 20)
      .map((b) => {
        const seat = b.players.indexOf(me);
        const opp = b.players.find((p) => p !== me) ?? "";
        const mine = b.status === "active" && b.turn === seat;
        const turnAt = Date.parse(b.turn_started_at ?? b.updated_at);
        let detail: string;
        if (b.status === "waiting") detail = `Invite sent. Code ${b.invite_code}.`;
        else if (b.status === "finished")
          detail = b.winner_id === me ? "You won. Rematch?" : b.winner_id ? `${name(opp)} won. Rematch?` : "A draw. Rematch?";
        else if (mine)
          detail =
            b.draw_offer !== null && b.draw_offer !== seat
              ? `Move ${Math.floor(b.ply / 2) + 1}. ${name(opp)} offered a draw.`
              : b.move_deadline
                ? `Your move, ${hours(Date.parse(b.move_deadline) - now)} h left.`
                : "Your move. Live now.";
        else detail = `Their move, ${hours(now - turnAt)} h since you played`;
        return {
          id: b.id,
          game: b.game_id,
          opponent: {
            name: b.status === "waiting" ? "a friend" : name(opp),
            color: color(opp),
            // no hat until a friend takes the invite (the seat isn't theirs yet), none for the bot
            hat:
              b.status === "waiting" || opp === BOT_PLAYER
                ? null
                : ((cards?.find((c) => c.id === opp)?.hat as string | null | undefined) ?? null),
          },
          detail,
          status: b.status === "finished" ? ("finished" as const) : mine ? ("your-move" as const) : ("their-move" as const),
          nudged: !!b.nudged_at,
          canNudge: b.mode === "async" && b.status === "active" && !mine && !b.nudged_at && now - turnAt >= TIMING.nudgeAfterMs,
        };
      })
  );
}
