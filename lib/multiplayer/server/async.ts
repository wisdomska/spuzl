import "server-only";
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, todayGmt } from "@/lib/api/server";
import { loadDaily, loadFree } from "@/lib/game/service";
import { decodeSolution } from "@/lib/game/solution-codec";
import { loadLogic } from "@/games/logic-registry";
import { GAME_BY_ID } from "@/lib/catalog";
import type { Difficulty } from "@/games/types";
import { dailyNumber } from "@/lib/format";
import { CODE_ALPHABET } from "../roomCode";

/* ---------------- Async challenge (Overlays A1, A2) ---------------- */

export const CHALLENGE_CODE_LENGTH = 6;
const challengeCode = () => Array.from({ length: CHALLENGE_CODE_LENGTH }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join("");

export interface TimelineSample {
  ms: number;
  state: unknown;
}

interface PuzzleRef {
  game_id: string;
  puzzle_id: string | null;
  free_seed: string | null;
}

async function puzzleFor(admin: SupabaseClient, ref: PuzzleRef) {
  if (ref.puzzle_id) {
    const { data } = await admin.from("puzzles").select("data, solution").eq("id", ref.puzzle_id).single();
    return { puzzle: data!.data as unknown, solution: decodeSolution(data!.solution) };
  }
  const [seed, difficulty] = (ref.free_seed ?? "").split("|");
  const l = await loadFree(ref.game_id, seed, (difficulty as Difficulty) || "easy");
  return { puzzle: l.puzzle, solution: l.solution };
}

/** Progress over time, computed by the server from the board states the client recorded. */
async function scoreTimeline(ref: PuzzleRef, samples: TimelineSample[] | undefined, totalMs: number, admin: SupabaseClient) {
  if (!samples?.length) return [] as [number, number][];
  const logic = await loadLogic(ref.game_id);
  const { puzzle, solution } = await puzzleFor(admin, ref);
  const out: [number, number][] = [];
  let lastMs = -1;
  for (const s of samples.slice(0, 40)) {
    if (!Number.isFinite(s.ms) || s.ms < lastMs || s.ms > totalMs + 1000) continue;
    lastMs = s.ms;
    let p = 0;
    try {
      p = Math.max(0, Math.min(1, logic.progress(puzzle, solution, s.state)));
    } catch {
      continue;
    }
    out.push([Math.round(s.ms), Math.round(p * 1000) / 1000]);
  }
  out.push([totalMs, 1]);
  return out;
}

async function clearedAttempt(admin: SupabaseClient, me: string, attemptId: string) {
  const { data: a } = await admin
    .from("attempts")
    .select("id, player_id, game_id, mode, daily_date, puzzle_id, free_seed, status, verified, time_ms, hints, mistakes, state")
    .eq("id", attemptId)
    .maybeSingle();
  if (!a || a.player_id !== me) throw new ApiError(404, "attempt_not_found");
  if (a.status !== "cleared" || !a.verified) throw new ApiError(409, "not_cleared");
  return a as PuzzleRef & {
    id: string;
    mode: string;
    daily_date: string | null;
    time_ms: number;
    hints: number;
    mistakes: number;
    state: unknown;
  };
}

export async function createChallenge(admin: SupabaseClient, me: string, attemptId: string, timeline?: TimelineSample[]) {
  const a = await clearedAttempt(admin, me, attemptId);
  const { data: existing } = await admin.from("challenges").select("code").eq("attempt_id", a.id).maybeSingle();
  if (existing) return { code: existing.code as string };
  const tl = await scoreTimeline(a, timeline, a.time_ms, admin);
  let date = a.daily_date;
  if (!date && a.puzzle_id) {
    const { data: d } = await admin.from("dailies").select("date").eq("puzzle_id", a.puzzle_id).maybeSingle();
    date = d?.date ?? null;
  }
  for (let i = 0; i < 8; i++) {
    const code = challengeCode();
    const { error } = await admin.from("challenges").insert({
      code,
      sender_id: me,
      game_id: a.game_id,
      puzzle_id: a.puzzle_id,
      free_seed: a.puzzle_id ? null : a.free_seed,
      difficulty: a.free_seed?.split("|")[1] ?? null,
      sender_ms: a.time_ms,
      sender_timeline: tl,
      attempt_id: a.id,
      daily_date: date,
      hints: a.hints,
      mistakes: a.mistakes,
    });
    if (!error) return { code };
    if (error.code !== "23505") throw error;
  }
  throw new ApiError(503, "no_code");
}

async function challengeByCode(admin: SupabaseClient, code: string) {
  const { data: c } = await admin.from("challenges").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (!c) throw new ApiError(404, "challenge_not_found");
  if (Date.parse(c.expires_at) < Date.now()) throw new ApiError(410, "challenge_expired", "This challenge ran out. Ask for a fresh link.");
  return c as PuzzleRef & {
    id: string;
    code: string;
    sender_id: string;
    sender_ms: number;
    sender_timeline: [number, number][] | null;
    daily_date: string | null;
    hints: number;
    mistakes: number;
    expires_at: string;
  };
}

export async function getChallenge(admin: SupabaseClient, me: string, code: string) {
  const c = await challengeByCode(admin, code);
  const [{ data: sender }, { data: mine }] = await Promise.all([
    admin.from("player_cards").select("id, nickname, avatar_color, level, city").eq("id", c.sender_id).maybeSingle(),
    admin.from("challenge_results").select("*").eq("challenge_id", c.id).eq("player_id", me).maybeSingle(),
  ]);
  return {
    code: c.code,
    game: c.game_id,
    label: c.daily_date ? `Daily #${dailyNumber(c.daily_date)}, same puzzle` : "Free play, same puzzle",
    sender: {
      id: c.sender_id,
      nickname: sender?.nickname ?? "Spuzler",
      color: sender?.avatar_color ?? "#B8F23A",
      level: sender?.level ?? 1,
      city: sender?.city ?? null,
    },
    senderMs: c.sender_ms,
    hints: c.hints,
    mistakes: c.mistakes,
    senderTimeline: c.sender_timeline ?? [],
    mine: c.sender_id === me,
    result: mine
      ? {
          attemptId: (mine.attempt_id as string | null) ?? null,
          timeMs: mine.time_ms as number,
          won: mine.won as boolean,
          hints: mine.hints as number,
          mistakes: mine.mistakes as number,
          timeline: mine.timeline ?? [],
        }
      : null,
    expiresAt: Date.parse(c.expires_at),
  };
}

export async function acceptChallenge(admin: SupabaseClient, me: string, code: string) {
  const c = await challengeByCode(admin, code);
  if (c.sender_id === me) throw new ApiError(409, "own_challenge", "That's your own challenge. Send it to a friend.");
  const { puzzle } = await puzzleFor(admin, c);
  const { data, error } = await admin
    .from("attempts")
    .insert({
      player_id: me,
      game_id: c.game_id,
      mode: "challenge",
      puzzle_id: c.puzzle_id,
      free_seed: c.puzzle_id ? null : c.free_seed,
      ref_id: c.id,
    })
    .select("id, started_at")
    .single();
  if (error) throw error;
  return {
    attemptId: data.id as string,
    puzzle,
    startedAt: data.started_at as string,
    game: c.game_id,
    senderMs: c.sender_ms,
    senderTimeline: c.sender_timeline ?? [],
  };
}

export async function challengeResult(admin: SupabaseClient, me: string, code: string, attemptId: string, timeline?: TimelineSample[]) {
  const c = await challengeByCode(admin, code);
  const a = await clearedAttempt(admin, me, attemptId);
  if (a.mode !== "challenge" || a.game_id !== c.game_id || a.puzzle_id !== c.puzzle_id || (!c.puzzle_id && a.free_seed !== c.free_seed))
    throw new ApiError(409, "different_puzzle");
  const tl = await scoreTimeline(c, timeline, a.time_ms, admin);
  const won = a.time_ms < c.sender_ms;
  await admin.from("challenge_results").upsert({
    challenge_id: c.id,
    player_id: me,
    time_ms: a.time_ms,
    won,
    attempt_id: a.id,
    hints: a.hints,
    mistakes: a.mistakes,
    timeline: tl,
  });
  return getChallenge(admin, me, code);
}

/* ---------------- Ghost Race (Overlays GR) ---------------- */

export const GHOST_GAMES = ["dash", "flipside", "ghosted"] as const;
export const isGhostGame = (g: string) => (GHOST_GAMES as readonly string[]).includes(g);

export async function startGhostRace(admin: SupabaseClient, me: string, game: string, runId?: string) {
  if (!isGhostGame(game) || !GAME_BY_ID[game]) throw new ApiError(404, "unknown_game");
  let puzzleId: string | null = null;
  let puzzle: unknown;
  let ghost: { name: string; log: unknown; timeMs: number; deaths: number; runId: string; mine: boolean } | null = null;
  const pick = async (q: PromiseLike<{ data: unknown }>) => {
    const { data } = (await q) as {
      data: { id: string; player_id: string; inputs: unknown; time_ms: number; deaths: number; puzzle_id: string | null } | null;
    };
    if (!data) return;
    const { data: card } = await admin.from("player_cards").select("nickname").eq("id", data.player_id).maybeSingle();
    ghost = {
      name: card?.nickname ?? "Spuzler",
      log: data.inputs,
      timeMs: data.time_ms,
      deaths: data.deaths,
      runId: data.id,
      mine: data.player_id === me,
    };
    puzzleId = data.puzzle_id;
  };
  if (runId && /^[0-9a-f-]{36}$/i.test(runId))
    await pick(
      admin
        .from("ghost_runs")
        .select("id, player_id, inputs, time_ms, deaths, puzzle_id")
        .eq("id", runId)
        .eq("game_id", game)
        .maybeSingle(),
    );
  if (!puzzleId) {
    const daily = await loadDaily(admin, game, todayGmt());
    puzzleId = daily.puzzleId;
    puzzle = daily.puzzle;
    if (!ghost && puzzleId) {
      const { data: fr } = await admin
        .from("friendships")
        .select("player_id, friend_id")
        .eq("status", "accepted")
        .or(`player_id.eq.${me},friend_id.eq.${me}`);
      const friends = (fr ?? []).map((f) => (f.player_id === me ? f.friend_id : f.player_id));
      const runs = admin.from("ghost_runs").select("id, player_id, inputs, time_ms, deaths, puzzle_id").eq("puzzle_id", puzzleId);
      if (friends.length) await pick(runs.in("player_id", friends).order("deaths").order("time_ms").limit(1).maybeSingle());
      if (!ghost)
        await pick(
          admin
            .from("ghost_runs")
            .select("id, player_id, inputs, time_ms, deaths, puzzle_id")
            .eq("puzzle_id", puzzleId)
            .eq("player_id", me)
            .order("deaths")
            .order("time_ms")
            .limit(1)
            .maybeSingle(),
        );
    }
  } else {
    const { data } = await admin.from("puzzles").select("data").eq("id", puzzleId).single();
    puzzle = data!.data;
  }
  const { data: att, error } = await admin
    .from("attempts")
    .insert({ player_id: me, game_id: game, mode: "challenge", puzzle_id: puzzleId })
    .select("id, started_at")
    .single();
  if (error) throw error;
  return { attemptId: att.id as string, puzzle, ghost, startedAt: att.started_at as string };
}

export async function saveGhostRun(admin: SupabaseClient, me: string, attemptId: string) {
  const a = await clearedAttempt(admin, me, attemptId);
  if (!isGhostGame(a.game_id) || !a.puzzle_id) throw new ApiError(409, "not_a_ghost_run");
  const st = a.state as { log?: unknown; deaths?: number; timeMs?: number } | null;
  if (!st?.log) throw new ApiError(409, "no_input_log");
  let date = a.daily_date;
  if (!date) {
    const { data: d } = await admin.from("dailies").select("date").eq("puzzle_id", a.puzzle_id).maybeSingle();
    date = d?.date ?? null;
  }
  const { data: existing } = await admin.from("ghost_runs").select("id").eq("attempt_id", a.id).maybeSingle();
  if (existing) return { runId: existing.id as string };
  const { data, error } = await admin
    .from("ghost_runs")
    .insert({
      player_id: me,
      game_id: a.game_id,
      daily_date: date,
      time_ms: st.timeMs ?? a.time_ms,
      deaths: st.deaths ?? 0,
      inputs: st.log,
      attempt_id: a.id,
      puzzle_id: a.puzzle_id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { runId: data.id as string };
}
