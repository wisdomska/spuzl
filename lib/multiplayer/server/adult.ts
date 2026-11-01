import "server-only";
import { randomInt } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ApiError, type PlayerCtx } from "@/lib/api/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { adultPartyCopy } from "@/lib/copy/adult-party";
import { adultPartyRefusal } from "@/lib/party-adult/gate";
import { DRAW_WORDS, type DrawWord } from "@/lib/party-adult/content";
import { TEXT_MAX, cleanText, partyTextProblem, type PartyTextKind } from "@/lib/party-adult/filter";
import { isAdultMode, leadFor, roundsFor, type AdultMode, type PartyMode } from "@/lib/party-adult/modes";
import { addAwards, checkGuess, drawAwards, placesOf, truthsAwards, wordShape, type Awards } from "@/lib/party-adult/scoring";
import { STROKE_LIMITS, fitsDrawing, pointsIn, type Stroke } from "@/lib/party-adult/strokes";
import { TIMING } from "../constants";
import type { AdultRoundView } from "../types";
import { commit, loadMatch, matchTopic, type Loaded, type MatchRow, type PlayerRow } from "./match";

/**
 * Draw It and Two Truths on the server (18+ party modes). Rooms are ordinary Party rooms (matches with
 * party_mode 'draw' or 'truths'); each round lives in party_rounds (server only). Every action checks the
 * age gate, the player's role in the round and the round's phase and clock; free text passes the party text
 * filter. Text and strokes are wiped when the round closes; reports keep a snapshot.
 */

const iso = (n: number) => new Date(n).toISOString();
const ms = (s: string | null | undefined) => (s ? Date.parse(s) : null);

export const modeOf = (m: Pick<MatchRow, "party_mode">): PartyMode => m.party_mode ?? "race";
export const isAdultRoom = (m: Pick<MatchRow, "party_mode">) => isAdultMode(modeOf(m));

/* ---------------- Gate ---------------- */

const refuse = (code: string, status = 403) => new ApiError(status, code, adultPartyCopy.errors[code] ?? code);

/**
 * The 18+ gate (lib/party-adult/gate.ts) for this request's player: switch on, signed in with an account,
 * 18+, not blocked. Throws a 403 otherwise. Returns when they confirmed the adults-only notice.
 */
export async function requireAdult(admin: SupabaseClient, user: User, player: PlayerCtx["player"]): Promise<{ noticeAt: string | null }> {
  const enabled = (await getGameSettings())["features.adultParty"];
  const guest = player.is_guest || !!user.is_anonymous;
  const early = adultPartyRefusal({ ageBand: player.age_band, guest }, enabled);
  if (early) throw refuse(early);
  const { data, error } = await admin.from("players").select("adult_party_blocked_until, adult_notice_at").eq("id", player.id).single();
  if (error) throw error;
  const blocked = adultPartyRefusal({ ageBand: player.age_band, guest, blockedUntil: data.adult_party_blocked_until }, enabled);
  if (blocked) throw refuse(blocked);
  return { noticeAt: data.adult_notice_at };
}

/** Records the one-time "Adults only" notice, or refuses to open a room until it is confirmed. */
export async function confirmNotice(admin: SupabaseClient, playerId: string, noticeAt: string | null, confirmed: boolean) {
  if (noticeAt) return;
  if (!confirmed) throw refuse("needs_adult_notice", 409);
  await admin
    .from("players")
    .update({ adult_notice_at: iso(Date.now()) })
    .eq("id", playerId);
}

/* ---------------- Rounds ---------------- */

export interface PartyRoundRow {
  match_id: string;
  set_no: number;
  round: number;
  mode: AdultMode;
  lead_id: string | null;
  word: string | null;
  statements: string[] | null;
  lie: number | null;
  strokes: Stroke[];
  phase: AdultRoundView["phase"];
  started_at: string;
  phase_ends_at: string;
  awards: Awards | null;
}

async function timings() {
  const s = await getGameSettings();
  return {
    drawMs: s["adultParty.drawSec"] * 1000,
    writeMs: s["adultParty.writeSec"] * 1000,
    voteMs: s["adultParty.voteSec"] * 1000,
    revealMs: s["adultParty.revealSec"] * 1000,
  };
}

const roundKey = (m: MatchRow) => ({ match_id: m.id, set_no: m.set_no, round: m.round });

async function getRound(admin: SupabaseClient, m: MatchRow): Promise<PartyRoundRow | null> {
  const { data, error } = await admin
    .from("party_rounds")
    .select("*")
    .eq("match_id", m.id)
    .eq("set_no", m.set_no)
    .eq("round", m.round)
    .maybeSingle();
  if (error) throw error;
  return (data as PartyRoundRow | null) ?? null;
}

/** A word not drawn yet this set, picked with server randomness (never derivable from the room id). */
async function freshWord(admin: SupabaseClient, m: MatchRow): Promise<string> {
  const { data } = await admin.from("party_rounds").select("word").eq("match_id", m.id).eq("set_no", m.set_no);
  const used = new Set((data ?? []).map((r) => r.word));
  const left = DRAW_WORDS.filter((w) => !used.has(w.word));
  const pool = left.length ? left : DRAW_WORDS;
  return pool[randomInt(0, pool.length)].word;
}

/** The current round's row, created once (concurrent callers get the same row). */
async function ensureRound(admin: SupabaseClient, m: MatchRow, startAt: number): Promise<PartyRoundRow | null> {
  const have = await getRound(admin, m);
  if (have) return have;
  const mode = modeOf(m);
  if (!isAdultMode(mode)) return null;
  const t = await timings();
  const row = {
    ...roundKey(m),
    mode,
    lead_id: leadFor(m.party_leads, m.round),
    word: mode === "draw" ? await freshWord(admin, m) : null,
    phase: mode === "draw" ? "play" : "write",
    started_at: iso(startAt),
    phase_ends_at: iso(startAt + (mode === "draw" ? t.drawMs : t.writeMs)),
  };
  const { error } = await admin.from("party_rounds").upsert(row, { onConflict: "match_id,set_no,round", ignoreDuplicates: true });
  if (error) throw error;
  return getRound(admin, m);
}

/** Moves a round from one phase to the next once; false when another request got there first. */
async function casPhase(admin: SupabaseClient, r: PartyRoundRow, from: PartyRoundRow["phase"], patch: Record<string, unknown>) {
  const { data, error } = await admin
    .from("party_rounds")
    .update(patch)
    .eq("match_id", r.match_id)
    .eq("set_no", r.set_no)
    .eq("round", r.round)
    .eq("phase", from)
    .select("round");
  if (error) throw error;
  return !!data?.length;
}

const isGone = (p: PlayerRow, now: number) => !!p.left_at || now - Date.parse(p.last_seen_at) > TIMING.reconnectMs;

/** Everyone in the round except the lead: guessers (Draw It) or voters (Two Truths). */
const othersIn = (l: Loaded, r: PartyRoundRow) =>
  l.players.filter((p) => !p.spectator && p.player_id !== r.lead_id && !isGone(p, l.now) && l.m.party_leads.includes(p.player_id));

/* ---------------- Start ---------------- */

export async function startAdult(admin: SupabaseClient, l: Loaded) {
  const leads = l.players
    .filter((p) => !p.left_at && !p.spectator)
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.player_id)
    .slice(0, 8);
  const rounds = roundsFor(leads.length);
  const startAt = Date.now() + TIMING.countdownMs;
  await admin.from("party_rounds").delete().eq("match_id", l.m.id);
  await admin
    .from("match_players")
    .update({ points: 0, place: null, progress: 0, mistakes: 0, finished_ms: null, state: null })
    .eq("match_id", l.m.id);
  const { data } = await admin
    .from("matches")
    .update({
      status: "playing",
      round: 1,
      games: Array.from({ length: rounds }, () => modeOf(l.m)),
      best_of: rounds,
      party_leads: leads,
      round_started_at: iso(startAt),
      round_first_at: null,
      winner_id: null,
      result: null,
    })
    .eq("id", l.m.id)
    .eq("status", "lobby")
    .select("id");
  if (!data?.length) throw new ApiError(409, "not_lobby");
  await ensureRound(admin, { ...l.m, round: 1, party_leads: leads, status: "playing" }, startAt);
  await serverBroadcast(matchTopic(l.m.id), "changed", { reason: "start" });
}

/* ---------------- Resolution (idempotent; any request may run it) ---------------- */

export async function resolveAdult(admin: SupabaseClient, l: Loaded): Promise<boolean> {
  const { m, now } = l;
  if (m.status !== "playing") return false;
  const start = ms(m.round_started_at);
  if (start === null || now < start) return false;
  const r = await ensureRound(admin, m, start);
  if (!r) return false;
  const t = await timings();
  const ends = Date.parse(r.phase_ends_at);
  const lead = l.players.find((p) => p.player_id === r.lead_id);
  const leadGone = !lead || isGone(lead, now);
  const reveal = (awards: Awards, extra: Record<string, unknown> = {}) =>
    casPhase(admin, r, r.phase, { phase: "reveal", awards, phase_ends_at: iso(now + t.revealMs), ...extra });

  let changed = false;
  if (r.phase === "write") {
    if (leadGone || now >= ends) changed = await reveal({}, { statements: null, lie: null });
  } else if (r.phase === "play") {
    const others = othersIn(l, r);
    if (r.mode === "draw") {
      const { data: g } = await admin
        .from("party_guesses")
        .select("player_id, elapsed_ms")
        .eq("match_id", m.id)
        .eq("set_no", m.set_no)
        .eq("round", m.round)
        .eq("correct", true);
      const correct = (g ?? []).map((x) => ({ playerId: x.player_id as string, elapsedMs: x.elapsed_ms as number }));
      const all = others.every((p) => correct.some((c) => c.playerId === p.player_id));
      if (now >= ends || leadGone || all) changed = await reveal(drawAwards(r.lead_id, correct, ends - Date.parse(r.started_at)));
    } else {
      const { data: v } = await admin
        .from("party_votes")
        .select("player_id, pick")
        .eq("match_id", m.id)
        .eq("set_no", m.set_no)
        .eq("round", m.round);
      const votes = (v ?? []).map((x) => ({ playerId: x.player_id as string, pick: x.pick as number }));
      const all = others.every((p) => votes.some((x) => x.playerId === p.player_id));
      if (now >= ends || all) changed = await reveal(truthsAwards(r.lead_id, r.lie ?? -1, votes));
    }
  } else if (r.phase === "reveal" && now >= ends) {
    changed = await advance(admin, l, r);
  }
  if (changed) await serverBroadcast(matchTopic(m.id), "changed", { reason: "party" });
  return changed;
}

/** Closes a round: adds its points, wipes its text and strokes, and opens the next round or the podium. */
async function advance(admin: SupabaseClient, l: Loaded, r: PartyRoundRow): Promise<boolean> {
  const { m } = l;
  const now = Date.now();
  const last = m.round >= m.party_leads.length;
  const inSet = l.players.filter((p) => !p.spectator && m.party_leads.includes(p.player_id));
  const totals = addAwards(Object.fromEntries(inSet.map((p) => [p.player_id, p.points])), r.awards ?? {});
  const places = new Map(placesOf(totals).map((x) => [x.id, x.place]));
  const winner = last ? (placesOf(totals)[0]?.id ?? null) : null;
  const applied = await commit(admin, l, {
    status: last ? "finished" : "playing",
    round: last ? m.round : m.round + 1,
    startAt: last ? null : now,
    winner,
    result: last ? "win" : null,
    players: inSet.map((p) => ({
      player_id: p.player_id,
      points: totals[p.player_id] ?? 0,
      ...(last ? { place: places.get(p.player_id) } : {}),
    })),
  });
  if (!applied) return false;
  await wipeRound(admin, r);
  if (!last) await ensureRound(admin, { ...m, round: m.round + 1, status: "playing", round_started_at: iso(now) }, now);
  return true;
}

/** No free text or drawing outlives its round (the word comes from our list and stays, so it isn't reused). */
async function wipeRound(admin: SupabaseClient, r: Pick<PartyRoundRow, "match_id" | "set_no" | "round">) {
  await admin
    .from("party_rounds")
    .update({ phase: "done", strokes: [], statements: null })
    .eq("match_id", r.match_id)
    .eq("set_no", r.set_no)
    .eq("round", r.round);
  await admin
    .from("party_guesses")
    .update({ text: null })
    .eq("match_id", r.match_id)
    .eq("set_no", r.set_no)
    .eq("round", r.round)
    .not("text", "is", null);
}

/** "Run it back" and room resets: drop every round of the room. */
export async function clearRounds(admin: SupabaseClient, matchId: string) {
  await admin.from("party_rounds").delete().eq("match_id", matchId);
}

/* ---------------- View ---------------- */

export async function adultRoundView(admin: SupabaseClient, l: Loaded, me: string): Promise<AdultRoundView | null> {
  const { m } = l;
  if (m.status !== "playing" || !isAdultRoom(m)) return null;
  const r = await getRound(admin, m);
  if (!r) return null;
  const [{ data: g }, { data: v }] = await Promise.all([
    r.mode === "draw"
      ? admin
          .from("party_guesses")
          .select("id, player_id, text, correct")
          .eq("match_id", m.id)
          .eq("set_no", m.set_no)
          .eq("round", m.round)
          .order("id", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] as { id: number; player_id: string; text: string | null; correct: boolean }[] }),
    r.mode === "truths"
      ? admin.from("party_votes").select("player_id, pick").eq("match_id", m.id).eq("set_no", m.set_no).eq("round", m.round)
      : Promise.resolve({ data: [] as { player_id: string; pick: number }[] }),
  ]);
  const lead = r.lead_id === me;
  const revealed = r.phase === "reveal" || r.phase === "done";
  const votes = (v ?? []).map((x) => ({ playerId: x.player_id as string, pick: x.pick as number }));
  const guesses = (g ?? [])
    .map((x) => ({ id: Number(x.id), playerId: x.player_id as string, text: (x.text as string | null) ?? null, correct: !!x.correct }))
    .filter((x) => x.correct || x.text !== null)
    .reverse();
  return {
    mode: r.mode,
    round: m.round,
    rounds: m.party_leads.length,
    phase: r.phase,
    leadId: r.lead_id,
    startedAt: Date.parse(r.started_at),
    endsAt: Date.parse(r.phase_ends_at),
    word: r.word && (revealed || lead) ? r.word : null,
    shape: r.word ? wordShape(r.word) : null,
    strokes: r.mode === "draw" ? (r.strokes ?? []) : [],
    guesses,
    statements: r.phase === "write" ? null : r.statements,
    lie: revealed || lead ? r.lie : null,
    myPick: votes.find((x) => x.playerId === me)?.pick ?? null,
    voters: votes.map((x) => x.playerId),
    votes: revealed ? votes : null,
    awards: revealed ? (r.awards ?? {}) : null,
    skipped: revealed && r.mode === "truths" && r.statements === null,
    iCorrect: guesses.some((x) => x.correct && x.playerId === me),
  };
}

/* ---------------- Actions ---------------- */

interface Act {
  l: Loaded;
  r: PartyRoundRow;
  me: PlayerRow;
}

/** Loads the room's live round for an action by a member who is still playing. */
async function liveRound(admin: SupabaseClient, matchId: string, playerId: string, round: number, mode: AdultMode): Promise<Act> {
  const l = await loadMatch(admin, matchId);
  const me = l.players.find((p) => p.player_id === playerId);
  if (!me || me.left_at) throw new ApiError(403, "not_in_match");
  if (me.spectator) throw new ApiError(403, "spectator");
  if (modeOf(l.m) !== mode) throw new ApiError(409, "wrong_mode");
  if (l.m.status !== "playing" || l.m.round !== round) throw refuse("round_closed", 409);
  const start = ms(l.m.round_started_at);
  if (start === null || l.now < start) throw new ApiError(409, "too_early");
  const r = await getRound(admin, l.m);
  if (!r) throw refuse("round_closed", 409);
  await admin
    .from("match_players")
    .update({ last_seen_at: iso(l.now) })
    .eq("match_id", matchId)
    .eq("player_id", playerId);
  return { l, r, me };
}

const open = (r: PartyRoundRow, phase: PartyRoundRow["phase"], now = Date.now()) => r.phase === phase && now < Date.parse(r.phase_ends_at);

/** Filtered, cleaned text, or a 422 with the friendly reason. */
export function checkedText(raw: string, kind: PartyTextKind): string {
  const problem = partyTextProblem(raw, kind);
  if (problem) {
    const t = adultPartyCopy.text;
    throw new ApiError(422, `text_${problem}`, problem === "too_long" ? t.too_long(TEXT_MAX[kind]) : t[problem]);
  }
  return cleanText(raw);
}

const changed = (id: string, reason: string) => serverBroadcast(matchTopic(id), "changed", { reason });

export async function drawStrokes(
  admin: SupabaseClient,
  matchId: string,
  playerId: string,
  input: { round: number; op: "add" | "undo" | "clear"; strokes?: Stroke[] },
) {
  const { l, r } = await liveRound(admin, matchId, playerId, input.round, "draw");
  if (r.lead_id !== playerId) throw refuse("not_your_turn");
  if (!open(r, "play")) throw refuse("round_closed", 409);
  const batch = input.op === "add" ? (input.strokes ?? []) : [];
  if (input.op === "add" && (!batch.length || !fitsDrawing({ strokes: r.strokes.length, points: pointsIn(r.strokes) }, batch)))
    throw new ApiError(422, "drawing_full", adultPartyCopy.draw.full);
  const { data, error } = await admin.rpc("svc_party_strokes", {
    p_match: l.m.id,
    p_set: l.m.set_no,
    p_round: l.m.round,
    p_player: playerId,
    p_op: input.op,
    p_strokes: input.op === "add" ? batch : null,
    p_max_strokes: STROKE_LIMITS.strokes,
    p_max_points: STROKE_LIMITS.points,
  });
  if (error) throw error;
  if (data === null) throw new ApiError(409, "drawing_full", adultPartyCopy.draw.full);
  await changed(l.m.id, "strokes");
  return { strokes: data as number };
}

const wordEntry = (word: string): DrawWord => DRAW_WORDS.find((w) => w.word === word) ?? { word };

export async function guess(admin: SupabaseClient, matchId: string, playerId: string, input: { round: number; text: string }) {
  const text = checkedText(input.text, "guess");
  const { l, r } = await liveRound(admin, matchId, playerId, input.round, "draw");
  if (r.lead_id === playerId || !l.m.party_leads.includes(playerId)) throw refuse("not_your_turn");
  if (!open(r, "play")) throw refuse("round_closed", 409);
  const result = checkGuess(text, wordEntry(r.word ?? ""));
  const { error } = await admin.from("party_guesses").insert({
    match_id: l.m.id,
    set_no: l.m.set_no,
    round: l.m.round,
    player_id: playerId,
    // Correct and giveaway guesses are never shown, so they aren't kept.
    text: result === "wrong" ? text : null,
    correct: result === "correct",
    elapsed_ms: Math.max(0, Date.now() - Date.parse(r.started_at)),
  });
  if (error?.code === "23505") throw refuse("already_guessed", 409);
  if (error) throw error;
  await changed(l.m.id, "guess");
  if (result === "correct") await resolveAdult(admin, await loadMatch(admin, matchId));
  return { result };
}

export async function writeStatements(
  admin: SupabaseClient,
  matchId: string,
  playerId: string,
  input: { round: number; statements: string[]; lie: number },
) {
  const statements = input.statements.map((s) => checkedText(s, "statement"));
  const { l, r } = await liveRound(admin, matchId, playerId, input.round, "truths");
  if (r.lead_id !== playerId) throw refuse("not_your_turn");
  if (!open(r, "write")) throw refuse("round_closed", 409);
  const t = await timings();
  const now = Date.now();
  const ok = await casPhase(admin, r, "write", {
    statements,
    lie: input.lie,
    phase: "play",
    started_at: iso(now),
    phase_ends_at: iso(now + t.voteMs),
  });
  if (!ok) throw refuse("round_closed", 409);
  await changed(l.m.id, "statements");
  return { ok: true };
}

export async function vote(admin: SupabaseClient, matchId: string, playerId: string, input: { round: number; pick: number }) {
  const { l, r } = await liveRound(admin, matchId, playerId, input.round, "truths");
  if (r.lead_id === playerId || !l.m.party_leads.includes(playerId)) throw refuse("not_your_turn");
  if (!open(r, "play")) throw refuse("round_closed", 409);
  const { error } = await admin
    .from("party_votes")
    .insert({ match_id: l.m.id, set_no: l.m.set_no, round: l.m.round, player_id: playerId, pick: input.pick });
  if (error?.code === "23505") throw refuse("already_voted", 409);
  if (error) throw error;
  await changed(l.m.id, "vote");
  await resolveAdult(admin, await loadMatch(admin, matchId));
  return { ok: true };
}

/* ---------------- Reports and kicks ---------------- */

export type ReportKind = "drawing" | "statements" | "guess";

/**
 * Reports a drawing, a set of statements or a guess from this room. The snapshot is built here from what the
 * server holds, never from the reporter's copy, and stored with the report for the moderation queue.
 */
export async function reportContent(
  admin: SupabaseClient,
  matchId: string,
  reporterId: string,
  input: { round: number; kind: ReportKind; guessId?: number; reason: "harassment" | "spam" | "other" },
) {
  const l = await loadMatch(admin, matchId);
  const me = l.players.find((p) => p.player_id === reporterId);
  if (!me) throw new ApiError(403, "not_in_match");
  const { data: r } = await admin
    .from("party_rounds")
    .select("*")
    .eq("match_id", matchId)
    .eq("set_no", l.m.set_no)
    .eq("round", input.round)
    .maybeSingle();
  const round = r as PartyRoundRow | null;
  if (!round || round.phase === "done") throw refuse("content_gone", 410);
  let target: string | null = round.lead_id;
  let content: Record<string, unknown>;
  if (input.kind === "drawing") {
    if (round.mode !== "draw" || !round.strokes.length) throw refuse("content_gone", 410);
    content = { word: round.word, strokes: round.strokes };
  } else if (input.kind === "statements") {
    if (round.mode !== "truths" || !round.statements) throw refuse("content_gone", 410);
    content = { statements: round.statements, lie: round.lie };
  } else {
    const { data: g } = await admin
      .from("party_guesses")
      .select("id, player_id, text")
      .eq("id", input.guessId ?? -1)
      .eq("match_id", matchId)
      .eq("set_no", l.m.set_no)
      .eq("round", input.round)
      .maybeSingle();
    if (!g?.text) throw refuse("content_gone", 410);
    target = g.player_id;
    content = { text: g.text, word: round.word };
  }
  if (!target) throw refuse("content_gone", 410);
  if (target === reporterId) throw new ApiError(400, "self");
  const ref = `${matchId}:${l.m.set_no}:${input.round}:${input.kind}:${input.guessId ?? ""}`;
  const { data: dup } = await admin
    .from("reports")
    .select("id")
    .eq("reporter_id", reporterId)
    .eq("target_type", "party")
    .eq("target_id", target)
    .eq("status", "open")
    .eq("snapshot->>ref", ref)
    .maybeSingle();
  if (dup) return { ok: true };
  const nick = l.players.find((p) => p.player_id === target)?.players?.nickname ?? null;
  const { error } = await admin.from("reports").insert({
    reporter_id: reporterId,
    target_type: "party",
    target_id: target,
    reason: input.reason,
    snapshot: {
      ref,
      mode: round.mode,
      kind: input.kind,
      code: l.m.code,
      matchId,
      setNo: l.m.set_no,
      round: input.round,
      nickname: nick,
      at: iso(Date.now()),
      ...content,
    },
  });
  if (error) throw error;
  return { ok: true };
}

/** Host removes a player from an 18+ room. They leave at once and can't rejoin this room. */
export async function kick(admin: SupabaseClient, l: Loaded, hostId: string, targetId: string) {
  if (!isAdultRoom(l.m)) throw new ApiError(409, "not_adult_room");
  if (l.m.host_id !== hostId) throw new ApiError(403, "host_only");
  if (targetId === hostId) throw new ApiError(400, "self");
  const t = l.players.find((p) => p.player_id === targetId);
  if (!t || t.left_at) throw new ApiError(404, "not_in_match");
  const now = iso(Date.now());
  await admin.from("match_players").update({ left_at: now, kicked_at: now, ready: false }).eq("match_id", l.m.id).eq("player_id", targetId);
  await serverBroadcast(matchTopic(l.m.id), "changed", { reason: "kick", player: targetId });
  if (l.m.status === "playing") await resolveAdult(admin, await loadMatch(admin, l.m.id));
  return { ok: true };
}

/**
 * A moderator actioned a party-content report: block the player from 18+ rooms for the configured days and
 * take them out of any 18+ room they are in now.
 */
export async function blockFromAdultParty(db: SupabaseClient, playerId: string): Promise<string> {
  const days = (await getGameSettings())["adultParty.blockDays"];
  const until = iso(Date.now() + days * 86_400_000);
  const { error } = await db.from("players").update({ adult_party_blocked_until: until }).eq("id", playerId);
  if (error) throw error;
  const { data } = await db
    .from("match_players")
    .select("match_id, matches!inner(party_mode, status)")
    .eq("player_id", playerId)
    .is("left_at", null)
    .neq("matches.party_mode", "race")
    .in("matches.status", ["lobby", "playing"]);
  const now = iso(Date.now());
  for (const row of data ?? []) {
    await db.from("match_players").update({ left_at: now, ready: false }).eq("match_id", row.match_id).eq("player_id", playerId);
    await serverBroadcast(matchTopic(row.match_id), "changed", { reason: "left", player: playerId });
  }
  return until;
}
