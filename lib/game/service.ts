import "server-only";
import { getGameSettings } from "@/lib/game-settings/server";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_BY_ID, LAUNCH_IDS, type GameMeta } from "@/lib/catalog";
import { loadLogic, hasLogic } from "@/games/logic-registry";
import { createRng } from "@/lib/rng";
import { difficultyForDate, type Difficulty, type Hint } from "@/games/types";
import { ApiError } from "@/lib/api/server";
import { dailySeed } from "@/lib/format";
import {
  dailyClearReward,
  freePlayReward,
  FULL_SPUZL,
  STREAK_MILESTONES,
  STREAK_MILESTONE_SPARKS,
  levelFromXp,
  type Reward,
} from "@/lib/rewards";
import { update as glicko, clampOneTier, dailyResult, weighted, DEFAULT_RATING, FREE_PLAY_WEIGHT } from "@/lib/rating/glicko2";
import { decodeSolution, encodeSolution } from "./solution-codec";
import { evaluateAfterClear, type Unlock } from "@/lib/gamification/progress";

export type Mode = "tutorial" | "daily" | "free" | "archive" | "challenge";

/** Phase 5 (lab) games are refused while the admin setting "features.newGames" is off. */
export async function assertGameOpen(meta: GameMeta): Promise<void> {
  if (meta.lab && !(await getGameSettings())["features.newGames"]) throw new ApiError(404, "unknown_game");
}

export function gameOr404(id: string): GameMeta {
  const g = GAME_BY_ID[id];
  if (!g) throw new ApiError(404, "unknown_game");
  if (!hasLogic(id)) throw new ApiError(404, "game_not_ready");
  return g;
}

export const solutionHash = (solution: unknown) => createHash("sha256").update(JSON.stringify(solution)).digest("hex");

/* ---------------- Puzzle delivery (never includes the solution) ---------------- */

export interface PuzzleRef {
  gameId: string;
  mode: Mode;
  date?: string;
  seed?: string;
  difficulty: Difficulty;
}

interface Loaded {
  puzzleId: string | null;
  puzzle: unknown;
  solution: unknown;
  difficulty: Difficulty;
}

export async function loadDaily(admin: SupabaseClient, gameId: string, date: string): Promise<Loaded> {
  const { data } = await admin
    .from("dailies")
    .select("puzzle_id, puzzles!dailies_puzzle_id_fkey(data, solution, difficulty)")
    .eq("game_id", gameId)
    .eq("date", date)
    .maybeSingle();
  const p = data?.puzzles as unknown as { data: unknown; solution: unknown; difficulty: Difficulty } | undefined;
  if (data && p) return { puzzleId: data.puzzle_id, puzzle: p.data, solution: decodeSolution(p.solution), difficulty: p.difficulty };
  // Safety net: no scheduled Daily (should never happen; the rollover alerts). Generate deterministically
  // from the date so every player still gets the same puzzle, and persist it.
  const difficulty = gameId === "gauntlet" ? "hard" : difficultyForDate(date);
  const logic = await loadLogic(gameId);
  const g = logic.generate(createRng(dailySeed(gameId, date)), difficulty);
  const { data: ins } = await admin
    .from("puzzles")
    .upsert(
      {
        game_id: gameId,
        seed: dailySeed(gameId, date),
        difficulty,
        grade: g.grade,
        data: g.puzzle,
        solution: encodeSolution(g.solution),
        solution_hash: solutionHash(g.solution),
        status: "scheduled",
      },
      { onConflict: "game_id,seed,difficulty" },
    )
    .select("id")
    .single();
  if (ins)
    await admin
      .from("dailies")
      .upsert({ date, game_id: gameId, puzzle_id: ins.id, published_at: new Date().toISOString() }, { onConflict: "date,game_id" });
  return { puzzleId: ins?.id ?? null, puzzle: g.puzzle, solution: g.solution, difficulty };
}

export async function loadFree(gameId: string, seed: string, difficulty: Difficulty): Promise<Loaded> {
  if (seed === "tutorial:crownfall") {
    const { TUTORIAL_PUZZLE, TUTORIAL_SOLUTION } = await import("@/games/crownfall/tutorial");
    return { puzzleId: null, puzzle: TUTORIAL_PUZZLE, solution: TUTORIAL_SOLUTION, difficulty: "easy" };
  }
  const logic = await loadLogic(gameId);
  const g = logic.generate(createRng(seed), difficulty);
  return { puzzleId: null, puzzle: g.puzzle, solution: g.solution, difficulty };
}

/* ---------------- Attempts ---------------- */

export async function startAttempt(admin: SupabaseClient, playerId: string, ref: PuzzleRef) {
  const meta = gameOr404(ref.gameId);
  await assertGameOpen(meta);
  let loaded: Loaded;
  let seed: string | null = null;
  if (ref.mode === "daily" || ref.mode === "archive") {
    if (!ref.date) throw new ApiError(400, "date_required");
    loaded = await loadDaily(admin, meta.id, ref.date);
    if (ref.mode === "daily") {
      // One ranked attempt per game per day: resume it if it exists.
      const { data: existing } = await admin
        .from("attempts")
        .select("id, status, state, started_at, hints, mistakes, active_ms")
        .eq("player_id", playerId)
        .eq("game_id", meta.id)
        .eq("daily_date", ref.date)
        .eq("mode", "daily")
        .maybeSingle();
      if (existing) {
        if (existing.status !== "in_progress")
          throw new ApiError(409, "daily_done", "Today's Daily is already cleared. Free play is open.");
        return {
          attemptId: existing.id,
          puzzle: loaded.puzzle,
          state: existing.state,
          startedAt: existing.started_at,
          resumed: true,
          activeMs: existing.active_ms ?? 0,
          hints: existing.hints,
        };
      }
    }
  } else {
    seed = ref.seed ?? `free:${meta.id}:${randomUUID()}`;
    loaded = await loadFree(meta.id, seed, ref.difficulty);
  }
  const { data, error } = await admin
    .from("attempts")
    .insert({
      player_id: playerId,
      game_id: meta.id,
      mode: ref.mode,
      daily_date: ref.mode === "daily" || ref.mode === "archive" ? ref.date : null,
      puzzle_id: loaded.puzzleId,
      free_seed: seed ? `${seed}|${loaded.difficulty}` : null,
    })
    .select("id, started_at")
    .single();
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "daily_in_progress");
    throw error;
  }
  return {
    attemptId: data.id,
    puzzle: loaded.puzzle,
    state: null,
    startedAt: data.started_at,
    resumed: false,
    activeMs: 0,
    hints: 0,
    // Hint packs from the Shop extend the 3 free hints in free play and the archive (never the ranked Daily).
    hintsBanked: usesBankedHints(ref.mode) ? await bankedHints(admin, playerId) : 0,
    seed,
  };
}

/** Free hints per puzzle before banked (bought) hints are spent. */
export const FREE_HINTS = 3;
const usesBankedHints = (mode: Mode) => mode === "free" || mode === "archive";

async function bankedHints(admin: SupabaseClient, playerId: string): Promise<number> {
  const { data } = await admin.from("players").select("practice_hints").eq("id", playerId).maybeSingle();
  return data?.practice_hints ?? 0;
}

interface AttemptRow {
  id: string;
  player_id: string;
  game_id: string;
  mode: Mode;
  daily_date: string | null;
  puzzle_id: string | null;
  free_seed: string | null;
  started_at: string;
  status: string;
  hints: number;
  mistakes: number;
  state: unknown;
}

async function getAttempt(admin: SupabaseClient, playerId: string, id: string): Promise<AttemptRow> {
  const { data } = await admin
    .from("attempts")
    .select("id, player_id, game_id, mode, daily_date, puzzle_id, free_seed, started_at, status, hints, mistakes, state")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.player_id !== playerId) throw new ApiError(404, "attempt_not_found");
  return data as AttemptRow;
}

async function loadForAttempt(admin: SupabaseClient, a: AttemptRow): Promise<Loaded> {
  if (a.puzzle_id) {
    const { data } = await admin.from("puzzles").select("data, solution, difficulty").eq("id", a.puzzle_id).single();
    return { puzzleId: a.puzzle_id, puzzle: data!.data, solution: decodeSolution(data!.solution), difficulty: data!.difficulty };
  }
  const [seed, difficulty] = (a.free_seed ?? "").split("|");
  return loadFree(a.game_id, seed, (difficulty as Difficulty) || "easy");
}

/**
 * The puzzle and solution behind one of the player's open attempts, for server-side guess checks. Content
 * games resolve guesses through this, so admin-scheduled custom items check against what was served.
 */
export async function attemptPuzzle(
  admin: SupabaseClient,
  playerId: string,
  id: string,
): Promise<{ gameId: string; puzzle: unknown; solution: unknown }> {
  const a = await getAttempt(admin, playerId, id);
  if (a.status !== "in_progress") throw new ApiError(409, "attempt_closed");
  const l = await loadForAttempt(admin, a);
  return { gameId: a.game_id, puzzle: l.puzzle, solution: l.solution };
}

export async function saveAttempt(admin: SupabaseClient, playerId: string, id: string, state: unknown, activeMs: number) {
  const a = await getAttempt(admin, playerId, id);
  if (a.status !== "in_progress") throw new ApiError(409, "attempt_closed");
  await admin
    .from("attempts")
    .update({ state, active_ms: Math.max(0, Math.floor(activeMs)), first_move_at: a.state ? undefined : new Date().toISOString() })
    .eq("id", id);
}

export async function hintFor(admin: SupabaseClient, playerId: string, id: string, state: unknown): Promise<Hint | null> {
  const a = await getAttempt(admin, playerId, id);
  if (a.status !== "in_progress") throw new ApiError(409, "attempt_closed");
  const banked = a.hints >= FREE_HINTS;
  if (banked && !usesBankedHints(a.mode)) throw new ApiError(429, "no_hints_left");
  const logic = await loadLogic(a.game_id);
  if (!logic.hint) return null;
  const l = await loadForAttempt(admin, a);
  const h = logic.hint(l.puzzle, l.solution, state);
  if (h && banked) {
    // Past the free hints: spend one from the Shop hint packs, or stop.
    const { data: spent, error } = await admin.rpc("svc_spend_practice_hint", { p_player: playerId });
    if (error) throw error;
    if (!spent) throw new ApiError(429, "no_hints_left");
  }
  if (h)
    await admin
      .from("attempts")
      .update({ hints: a.hints + 1, state })
      .eq("id", id);
  return h;
}

/* ---------------- Finish: verification, anti-cheat, rewards ---------------- */

export interface FinishInput {
  state: unknown;
  /** client active time (excludes pauses and hidden time) */
  activeMs: number;
  mistakes: number;
  deaths?: number;
  relaxed?: boolean;
  /** clears made offline and synced later */
  offline?: boolean;
  finishedAt?: string;
  localHour?: number;
}

export interface FinishResult {
  ok: boolean;
  status: "cleared" | "failed" | "flagged";
  timeMs: number;
  score?: number;
  reward: Reward;
  percentile: number | null;
  level: { before: number; after: number; into: number; need: number };
  streak: { current: number; extended: boolean; milestone: number | null; freezeEarned: boolean } | null;
  fullSpuzl: boolean;
  unlocks: Unlock[];
  rank: { track: string; before: number; after: number } | null;
}

const WALL_SLACK_MS = 3000;

export async function finishAttempt(
  admin: SupabaseClient,
  playerId: string,
  id: string,
  input: FinishInput,
  rankingRevoked: boolean,
): Promise<FinishResult> {
  const a = await getAttempt(admin, playerId, id);
  if (a.status !== "in_progress") throw new ApiError(409, "attempt_closed");
  const meta = gameOr404(a.game_id);
  const logic = await loadLogic(a.game_id);
  const l = await loadForAttempt(admin, a);
  const verdict = logic.verify(l.puzzle, l.solution, input.state);

  const finishedAt = input.offline && input.finishedAt ? new Date(input.finishedAt) : new Date();
  const wallMs = finishedAt.getTime() - new Date(a.started_at).getTime();
  const timeMs = Math.max(0, Math.round(input.activeMs));
  const nobody = {
    ok: false,
    status: "failed" as const,
    timeMs,
    reward: { xp: 0, sparks: 0, lines: [] },
    percentile: null,
    level: { before: 0, after: 0, into: 0, need: 0 },
    streak: null,
    fullSpuzl: false,
    unlocks: [],
    rank: null,
  };

  if (!verdict.ok) {
    await admin
      .from("attempts")
      .update({ status: "failed", state: input.state, finished_at: finishedAt.toISOString(), time_ms: timeMs, mistakes: input.mistakes })
      .eq("id", id);
    return nobody;
  }

  // Anti-cheat (SRS 12.3): impossible speed and client time exceeding server wall time are flagged, not ranked.
  let flag: string | null = null;
  // The tutorial is played before the profile exists, so its attempt is created after the clear;
  // its reward is fixed and granted once, so wall-clock checks do not apply.
  if (a.mode === "tutorial") flag = null;
  else if (timeMs < meta.minTimeMs) flag = `below human floor (${timeMs} < ${meta.minTimeMs} ms)`;
  else if (timeMs > wallMs + WALL_SLACK_MS) flag = `client time ${timeMs} exceeds server wall time ${wallMs}`;
  else if (input.offline && a.mode === "daily" && a.daily_date && finishedAt.toISOString().slice(0, 10) !== a.daily_date)
    flag = "offline clear outside its day";

  await admin
    .from("attempts")
    .update({
      status: flag ? "flagged" : "cleared",
      verified: !flag,
      flag_reason: flag,
      state: input.state,
      finished_at: finishedAt.toISOString(),
      time_ms: timeMs,
      mistakes: input.mistakes,
      deaths: input.deaths ?? 0,
      score: verdict.score ?? null,
      relaxed: !!input.relaxed,
      offline: !!input.offline,
    })
    .eq("id", id);

  const { data: before } = await admin.from("players").select("xp, level").eq("id", playerId).single();
  const lvBefore = before?.level ?? 1;
  let reward: Reward = { xp: 0, sparks: 0, lines: [] };
  let percentile: number | null = null;
  let streak: FinishResult["streak"] = null;
  let fullSpuzl = false;
  let rank: FinishResult["rank"] = null;

  if (flag) {
    // Flagged clears still count as a clear for the player, but give no ranked rewards until a moderator clears them.
    const lv = levelFromXp(before?.xp ?? 0);
    return { ...nobody, ok: true, status: "flagged", timeMs, level: { before: lvBefore, after: lvBefore, into: lv.into, need: lv.need } };
  }

  if (a.mode === "daily" && a.daily_date) {
    const { count: prior } = await admin
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("game_id", a.game_id)
      .in("status", ["cleared"])
      .neq("id", id);
    const { data: median } = await admin.rpc("svc_daily_median", { p_game: a.game_id, p_date: a.daily_date });
    reward = dailyClearReward({
      hintXpKeptPct: (await getGameSettings())["hints.dailyXpKeptPct"],
      timeMs,
      hints: a.hints,
      mistakes: input.mistakes,
      deaths: input.deaths,
      medianMs: median ?? null,
      firstClearOfGameEver: (prior ?? 0) === 0,
      relaxed: input.relaxed,
    });
    if (!input.relaxed && !rankingRevoked) {
      const { data: rec } = await admin.rpc("svc_record_daily_clear", {
        p_player: playerId,
        p_game: a.game_id,
        p_date: a.daily_date,
        p_time: timeMs,
        p_score: verdict.score ?? null,
        p_hints: a.hints,
        p_mistakes: input.mistakes,
      });
      const r = Array.isArray(rec) ? rec[0] : rec;
      const milestone = r?.extended && STREAK_MILESTONES.includes(r.streak) ? r.streak : null;
      streak = { current: r?.streak ?? 0, extended: !!r?.extended, milestone, freezeEarned: !!r?.freeze_earned };
      if (milestone)
        await admin.rpc("svc_grant_reward", {
          p_player: playerId,
          p_source: "streak_milestone",
          p_ref: String(milestone),
          p_xp: 0,
          p_sparks: STREAK_MILESTONE_SPARKS[milestone] ?? 0,
        });
      const { data: pct } = await admin.rpc("svc_daily_percentile", { p_game: a.game_id, p_date: a.daily_date, p_time: timeMs });
      percentile = pct === null ? null : Number(pct);
      rank = await updateRating(admin, playerId, meta.world, percentile ?? 50, a.hints, input.mistakes);
    } else {
      // Relaxed or revoked: still a streak day, but no leaderboard entry.
      const { data: rec } = await admin.rpc("svc_record_daily_clear", {
        p_player: playerId,
        p_game: a.game_id,
        p_date: a.daily_date,
        p_time: timeMs,
        p_score: verdict.score ?? null,
        p_hints: a.hints,
        p_mistakes: input.mistakes,
      });
      const r = Array.isArray(rec) ? rec[0] : rec;
      streak = { current: r?.streak ?? 0, extended: !!r?.extended, milestone: null, freezeEarned: !!r?.freeze_earned };
      if (input.relaxed)
        await admin.from("daily_results").delete().eq("player_id", playerId).eq("game_id", a.game_id).eq("date", a.daily_date);
    }
    await admin.rpc("svc_grant_reward", {
      p_player: playerId,
      p_source: "daily",
      p_ref: `${a.game_id}:${a.daily_date}`,
      p_xp: reward.xp,
      p_sparks: reward.sparks,
    });
    // Full Spuzl: all of today's featured Dailies cleared.
    const { data: todays } = await admin
      .from("daily_results")
      .select("game_id")
      .eq("player_id", playerId)
      .eq("date", a.daily_date)
      .in("game_id", LAUNCH_IDS);
    if ((todays?.length ?? 0) >= LAUNCH_IDS.length) {
      const { data: g } = await admin.rpc("svc_grant_reward", {
        p_player: playerId,
        p_source: "full_spuzl",
        p_ref: a.daily_date,
        p_xp: FULL_SPUZL.xp,
        p_sparks: FULL_SPUZL.sparks,
      });
      fullSpuzl = (Array.isArray(g) ? g[0] : g)?.xp_added > 0;
      if (fullSpuzl) reward.lines.push({ label: "Full Spuzl", xp: FULL_SPUZL.xp, sparks: FULL_SPUZL.sparks });
    }
    await admin.from("feed_events").insert({
      player_id: playerId,
      kind: fullSpuzl ? "full_spuzl" : "clear",
      game_id: a.game_id,
      payload: { timeMs, hints: a.hints, date: a.daily_date },
    });
  } else if (a.mode === "free") {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { data: today } = await admin
      .from("xp_ledger")
      .select("amount")
      .eq("player_id", playerId)
      .eq("source", "free")
      .gte("created_at", since.toISOString());
    const earned = (today ?? []).reduce((s, r) => s + r.amount, 0);
    const { count: dup } = await admin
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("free_seed", a.free_seed!)
      .eq("status", "cleared")
      .neq("id", id);
    reward = freePlayReward(earned, (dup ?? 0) > 0);
    await admin.rpc("svc_grant_reward", { p_player: playerId, p_source: "free", p_ref: id, p_xp: reward.xp, p_sparks: reward.sparks });
    // Dailies off: a day with at least one free-play clear keeps the streak going (and lights it).
    if (!(await getGameSettings())["features.dailies"]) {
      const { data: rec } = await admin.rpc("svc_record_play_day", { p_player: playerId, p_date: finishedAt.toISOString().slice(0, 10) });
      const r = Array.isArray(rec) ? rec[0] : rec;
      const milestone = r?.extended && STREAK_MILESTONES.includes(r.streak) ? r.streak : null;
      streak = { current: r?.streak ?? 0, extended: !!r?.extended, milestone, freezeEarned: !!r?.freeze_earned };
      if (milestone)
        await admin.rpc("svc_grant_reward", {
          p_player: playerId,
          p_source: "streak_milestone",
          p_ref: String(milestone),
          p_xp: 0,
          p_sparks: STREAK_MILESTONE_SPARKS[milestone],
        });
    }
    // World ranks move on free play too, at a smaller weight than a Daily. A replayed seed never moves them.
    if (!input.relaxed && !rankingRevoked && (dup ?? 0) === 0) {
      const difficulty = (a.free_seed ?? "").split("|")[1] || "easy";
      const { data: pct } = await admin.rpc("svc_free_percentile", {
        p_game: a.game_id,
        p_difficulty: difficulty,
        p_time: timeMs,
        p_attempt: id,
      });
      // Not returned as `percentile`: the results screen reads that as "faster than N% of Spuzlers today".
      const field = pct === null || pct === undefined ? 50 : Number(pct);
      rank = await updateRating(admin, playerId, meta.world, field, a.hints, input.mistakes, FREE_PLAY_WEIGHT);
    }
  } else if (a.mode === "archive" && a.daily_date) {
    reward = dailyClearReward({
      hintXpKeptPct: (await getGameSettings())["hints.dailyXpKeptPct"],
      timeMs,
      hints: a.hints,
      mistakes: input.mistakes,
      medianMs: null,
      firstClearOfGameEver: false,
      archive: true,
    });
    await admin.rpc("svc_grant_reward", {
      p_player: playerId,
      p_source: "archive",
      p_ref: `${a.game_id}:${a.daily_date}`,
      p_xp: reward.xp,
      p_sparks: 0,
    });
  } else if (a.mode === "tutorial") {
    // Designed first-clear screen: +150 XP, +50 Sparks (40 here + 10 from the First Clear badge).
    reward = { xp: 150, sparks: 50, lines: [{ label: "First clear", xp: 150, sparks: 50 }] };
    await admin.rpc("svc_grant_reward", { p_player: playerId, p_source: "tutorial", p_ref: "first", p_xp: 150, p_sparks: 40 });
    // The first-ever clear lights the streak (design O3 shows Streak 1).
    const today = new Date().toISOString().slice(0, 10);
    const { data: s } = await admin.from("streaks").select("current").eq("player_id", playerId).maybeSingle();
    if (!s?.current) await admin.from("streaks").upsert({ player_id: playerId, current: 1, best: 1, last_clear_date: today });
    streak = { current: 1, extended: true, milestone: null, freezeEarned: false };
  }

  const unlocks = await evaluateAfterClear(admin, playerId, {
    gameId: a.game_id,
    world: meta.world,
    mode: a.mode,
    timeMs,
    hints: a.hints,
    mistakes: input.mistakes,
    deaths: input.deaths ?? 0,
    date: a.daily_date,
    localHour: input.localHour,
    fullSpuzl,
    streak: streak?.current ?? 0,
  });
  const { data: after } = await admin.from("players").select("xp, level").eq("id", playerId).single();
  const lv = levelFromXp(after?.xp ?? 0);
  return {
    ok: true,
    status: "cleared",
    timeMs,
    score: verdict.score,
    reward,
    percentile,
    level: { before: lvBefore, after: after?.level ?? lv.level, into: lv.into, need: lv.need },
    streak,
    fullSpuzl,
    unlocks,
    rank,
  };
}

async function updateRating(
  admin: SupabaseClient,
  playerId: string,
  track: string,
  percentile: number,
  hints: number,
  mistakes: number,
  weight = 1,
) {
  const { data } = await admin.from("ratings").select("rating, rd, vol, games").eq("player_id", playerId).eq("track", track).maybeSingle();
  const cur = data ? { rating: Number(data.rating), rd: Number(data.rd), vol: Number(data.vol) } : DEFAULT_RATING;
  const raw = weighted(cur, glicko(cur, [dailyResult(percentile, hints, mistakes)]), weight);
  const next = { ...raw, rating: clampOneTier(cur.rating, raw.rating) };
  await admin.from("ratings").upsert({
    player_id: playerId,
    track,
    rating: next.rating.toFixed(2),
    rd: next.rd.toFixed(2),
    vol: next.vol.toFixed(6),
    games: (data?.games ?? 0) + 1,
    updated_at: new Date().toISOString(),
  });
  return { track, before: cur.rating, after: next.rating };
}
