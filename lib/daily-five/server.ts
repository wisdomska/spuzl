import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_BY_ID, openGame, playerGames, type WorldId } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-registry";
import { loadServedLogic as loadLogic } from "@/lib/game/served-logic";
import type { ContentLogic, Difficulty, GameLogic } from "@/games/types";
import { createRng } from "@/lib/rng";
import { dailyNumber } from "@/lib/format";
import { encodeSolution } from "@/lib/game/solution-codec";
import { getGameSettings } from "@/lib/game-settings/server";
import type { GameSettings } from "@/lib/game-settings/schema";
import { loadGamesMeta } from "@/lib/games-meta/server";
import { ApiError } from "@/lib/api/server";
import {
  FIVE_SLOTS,
  MAX_SCORE,
  fiveDate,
  fivePoints,
  isFinished,
  msToFiveReset,
  pickFive,
  replaceSlots,
  rulesFrom,
  slotsFor,
  type Candidate,
  type FivePick,
  type FiveState,
  type ScheduleDay,
} from "./index";

/** One stored slot of a day (public.daily_five). */
export interface FiveRow {
  date: string;
  slot: number;
  kind: "world" | "bonus";
  world: WorldId;
  game_id: string;
  puzzle_id: string;
  source: "auto" | "manual";
  locked: boolean;
  updated_at?: string;
  difficulty?: string;
}

/** One game of today's five as players see it (GET /api/v1/daily-five). */
export interface FiveGame {
  slot: number;
  kind: "world" | "bonus";
  world: WorldId;
  game: string;
  name: string;
  state: FiveState;
  timeMs: number | null;
  points: number;
}

export interface DailyFiveView {
  enabled: boolean;
  date: string;
  number: number;
  resetsInMs: number;
  games: FiveGame[];
  done: number;
  total: number;
  score: number;
  maxScore: number;
  complete: boolean;
}

const COLS = "date, slot, kind, world, game_id, puzzle_id, source, locked, updated_at";

/** Games the auto-pick can choose from: the ones with logic that are On (Games page state). */
export async function fiveCandidates(settings: GameSettings): Promise<Candidate[]> {
  const meta = await loadGamesMeta();
  const games = playerGames(settings).filter((g) => hasLogic(g.id));
  return games.map((g) => ({ id: g.id, world: g.world, typicalSec: meta[g.id]?.typicalSec ?? 180 }));
}

/** A game an admin may put in a Daily Five (manual pick or import). */
export function schedulableGame(id: string, settings: GameSettings): boolean {
  return !!openGame(id, settings) && hasLogic(id);
}

/**
 * Makes and stores the Daily Five puzzle for (game, date) at `difficulty`, the same for everyone. Content games
 * take that date's item (generateAt); logic games with a unique answer are proven unique, with up to two more
 * seeds if the first board is not.
 */
export async function makeFivePuzzle(db: SupabaseClient, game: string, date: string, difficulty: Difficulty): Promise<string> {
  const logic = (await loadLogic(game)) as GameLogic<unknown, unknown, unknown> & Partial<ContentLogic<unknown, unknown, unknown>>;
  for (let k = 0; k < 3; k++) {
    const seed = k ? `five:${game}:${date}:${k}` : `five:${game}:${date}`;
    const gen =
      typeof logic.generateAt === "function"
        ? logic.generateAt(dailyNumber(date) + k, difficulty)
        : logic.generate(createRng(seed), difficulty);
    if (GAME_BY_ID[game]?.unique && logic.countSolutions && logic.countSolutions(gen.puzzle, 2) !== 1) continue;
    const { data, error } = await db
      .from("puzzles")
      .upsert(
        {
          game_id: game,
          seed,
          difficulty,
          grade: gen.grade,
          data: gen.puzzle,
          solution: encodeSolution(gen.solution),
          solution_hash: createHash("sha256")
            .update(JSON.stringify(gen.solution ?? null))
            .digest("hex"),
          status: "scheduled",
        },
        { onConflict: "game_id,seed,difficulty" },
      )
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }
  throw new ApiError(422, "no_valid_puzzle", `Could not make a ${game} puzzle for ${date}.`);
}

export async function readDay(db: SupabaseClient, date: string): Promise<FiveRow[]> {
  const { data, error } = await db.from("daily_five").select(COLS).eq("date", date).order("slot");
  if (error) throw error;
  return (data ?? []) as FiveRow[];
}

/** Stores a day's picks (any old unlocked rows replaced), making each puzzle first. */
export async function writeDay(
  db: SupabaseClient,
  date: string,
  picks: FivePick[],
  difficulty: Difficulty,
  source: "auto" | "manual",
  actor: string | null,
  replace: boolean,
): Promise<FiveRow[]> {
  const ids = await Promise.all(picks.map((p) => makeFivePuzzle(db, p.game, date, difficulty)));
  const rows = picks.map((p, i) => ({
    date,
    slot: p.slot,
    kind: p.kind,
    world: p.world,
    game_id: p.game,
    puzzle_id: ids[i],
    source,
    locked: false,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  }));
  if (replace) {
    const { error } = await db.from("daily_five").delete().eq("date", date);
    if (error) throw error;
    const { error: e2 } = await db.from("daily_five").insert(rows);
    if (e2) throw e2;
  } else {
    // First pick of a day: two requests at once make the same picks, so the second one simply finds the row.
    const { error } = await db.from("daily_five").upsert(rows, { onConflict: "date,slot", ignoreDuplicates: true });
    if (error && error.code !== "23505") throw error;
  }
  return readDay(db, date);
}

/** The day's five, picked and stored the first time anyone asks for it (the cron normally does this ahead). */
export async function ensureDay(db: SupabaseClient, date: string, settings?: GameSettings): Promise<FiveRow[]> {
  const have = await readDay(db, date);
  if (have.length) return have;
  const s = settings ?? (await getGameSettings());
  const rules = rulesFrom(s);
  const picks = pickFive(date, rules, await fiveCandidates(s));
  return writeDay(db, date, picks, rules.difficulty, "auto", null, false);
}

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Keeps the Daily Five scheduled `dailyFive.daysAhead` days ahead (cron /api/cron/generate). Missing days are
 * picked; future automatic days that are not locked are re-picked when the rules now give other games or another
 * difficulty. Today, past days, locked days and manual days are never changed, except that a game players can no
 * longer open is swapped out first (repickClosedGames).
 */
export async function fillFive(db: SupabaseClient, settings?: GameSettings) {
  const s = settings ?? (await getGameSettings());
  const rules = rulesFrom(s);
  // R4-06: first, days that hold a game that was switched off (normally done at once by the settings change).
  const closed = await repickClosedGames(db, s);
  const candidates = await fiveCandidates(s);
  const today = fiveDate(new Date(), rules.resetHour);
  const through = addDays(today, rules.daysAhead - 1);
  const { data, error } = await db
    .from("daily_five")
    .select(`${COLS}, puzzles!daily_five_puzzle_id_fkey(difficulty)`)
    .gte("date", today)
    .lte("date", through)
    .order("date")
    .order("slot");
  if (error) throw error;
  const byDate = new Map<string, (FiveRow & { puzzles?: { difficulty: string } | null })[]>();
  for (const r of (data ?? []) as unknown as (FiveRow & { puzzles?: { difficulty: string } | null })[])
    byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  let made = 0;
  let repicked = 0;
  let kept = 0;
  for (let i = 0; i < rules.daysAhead; i++) {
    const date = addDays(today, i);
    const rows = byDate.get(date) ?? [];
    const picks = pickFive(date, rules, candidates);
    if (!rows.length) {
      await writeDay(db, date, picks, rules.difficulty, "auto", null, false);
      made++;
      continue;
    }
    const auto = rows.every((r) => r.source === "auto" && !r.locked);
    const same =
      rows.length === picks.length &&
      rows.every(
        (r, j) =>
          r.game_id === picks[j].game && r.slot === picks[j].slot && (r.puzzles?.difficulty ?? rules.difficulty) === rules.difficulty,
      );
    if (date > today && auto && !same) {
      await writeDay(db, date, picks, rules.difficulty, "auto", null, true);
      repicked++;
    } else kept++;
  }
  return { made, repicked, kept, from: today, through, closed };
}

export interface ClosedRepick {
  /** days changed: a whole re-pick (future automatic days nobody has played) or only the closed games' slots */
  days: { date: string; how: "repick" | "swap"; before: string[]; after: string[] }[];
  /** days that still hold a closed game: locked days, or a slot with no game left to take */
  kept: { date: string; reason: "locked" | "no_game" }[];
}

/**
 * R4-06: today's and future unlocked Daily Five days that hold a game players can no longer open (switched Off or
 * put In testing on the Games page) get new games, so the server never refuses a slot. A future automatic day
 * nobody has played is re-picked whole under the current rules (what the daily job would pick); today, a manual
 * day or a day already started keeps its other games and only the closed slots change, each to a new puzzle.
 * Locked days are never changed. The caller audits the result (settings change, cron, admin fill).
 */
export async function repickClosedGames(db: SupabaseClient, settings?: GameSettings, actor: string | null = null): Promise<ClosedRepick> {
  const s = settings ?? (await getGameSettings());
  const rules = rulesFrom(s);
  const today = fiveDate(new Date(), rules.resetHour);
  const through = addDays(today, rules.daysAhead - 1);
  const closed = (id: string) => !schedulableGame(id, s);
  const out: ClosedRepick = { days: [], kept: [] };
  const { data, error } = await db.from("daily_five").select(COLS).gte("date", today).lte("date", through).order("date").order("slot");
  if (error) throw error;
  const byDate = new Map<string, FiveRow[]>();
  for (const r of (data ?? []) as FiveRow[]) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  const hit = [...byDate.entries()].filter(([, rows]) => rows.some((r) => closed(r.game_id)));
  if (!hit.length) return out;
  const candidates = await fiveCandidates(s);
  for (const [date, rows] of hit) {
    if (rows.some((r) => r.locked)) {
      out.kept.push({ date, reason: "locked" });
      continue;
    }
    const before = rows.map((r) => r.game_id);
    const { count } = await db.from("attempts").select("id", { count: "exact", head: true }).eq("daily_five", true).eq("daily_date", date);
    if (date > today && !count && rows.every((r) => r.source === "auto")) {
      const after = await writeDay(db, date, pickFive(date, rules, candidates), rules.difficulty, "auto", actor, true);
      out.days.push({ date, how: "repick", before, after: after.map((r) => r.game_id) });
      continue;
    }
    const swaps = replaceSlots(
      date,
      rows.map((r) => ({ slot: r.slot, kind: r.kind, world: r.world, game: r.game_id })),
      closed,
      rules,
      candidates,
    );
    for (const p of swaps) {
      const puzzle = await makeFivePuzzle(db, p.game, date, rules.difficulty);
      const { error: e } = await db
        .from("daily_five")
        .update({
          kind: p.kind,
          world: p.world,
          game_id: p.game,
          puzzle_id: puzzle,
          updated_at: new Date().toISOString(),
          updated_by: actor,
        })
        .eq("date", date)
        .eq("slot", p.slot);
      if (e) throw e;
    }
    if (swaps.length) out.days.push({ date, how: "swap", before, after: (await readDay(db, date)).map((r) => r.game_id) });
    if (rows.filter((r) => closed(r.game_id)).length > swaps.length) out.kept.push({ date, reason: "no_game" });
  }
  return out;
}

/** The Daily Five slot of `game` on `date`, if it is in that day's five. */
export async function fiveSlot(db: SupabaseClient, date: string, game: string): Promise<FiveRow | null> {
  const { data } = await db.from("daily_five").select(COLS).eq("date", date).eq("game_id", game).maybeSingle();
  return (data as FiveRow | null) ?? null;
}

interface AttemptLite {
  game_id: string;
  status: string;
  time_ms: number | null;
  hints: number | null;
  mistakes: number | null;
  first_move_at: string | null;
  score?: number | null;
}

function stateOf(a: AttemptLite | undefined): FiveState {
  if (!a) return "new";
  if (a.status === "cleared") return "cleared";
  if (a.status === "flagged") return "flagged";
  if (a.status === "failed" || a.status === "abandoned") return "failed";
  return a.first_move_at ? "in_progress" : "new";
}

/** Today's five, this player's progress (when signed in) and their combined score, all from the server's records. */
export async function loadDailyFive(playerId: string | null, db: SupabaseClient, now = new Date()): Promise<DailyFiveView> {
  const s = await getGameSettings();
  const rules = rulesFrom(s);
  const date = fiveDate(now, rules.resetHour);
  const base = { date, number: dailyNumber(date), resetsInMs: msToFiveReset(now, rules.resetHour), maxScore: MAX_SCORE };
  if (!s["dailyFive.enabled"]) return { enabled: false, ...base, games: [], done: 0, total: FIVE_SLOTS, score: 0, complete: false };
  const rows = await ensureDay(db, date, s);
  const meta = await loadGamesMeta();
  const attempts = new Map<string, AttemptLite>();
  if (playerId && rows.length) {
    const { data } = await db
      .from("attempts")
      .select("game_id, status, time_ms, hints, mistakes, first_move_at, score")
      .eq("player_id", playerId)
      .eq("mode", "daily")
      .eq("daily_date", date)
      .in(
        "game_id",
        rows.map((r) => r.game_id),
      );
    for (const a of (data ?? []) as AttemptLite[]) attempts.set(a.game_id, a);
  }
  const games: FiveGame[] = rows.map((r) => {
    const a = attempts.get(r.game_id);
    const state = stateOf(a);
    return {
      slot: r.slot,
      kind: r.kind,
      world: r.world,
      game: r.game_id,
      name: GAME_BY_ID[r.game_id]?.name ?? r.game_id,
      state,
      timeMs: isFinished(state) ? (a?.time_ms ?? null) : null,
      points: fivePoints(
        { state, timeMs: a?.time_ms, hints: a?.hints ?? 0, mistakes: a?.mistakes ?? 0, score: a?.score },
        meta[r.game_id]?.typicalSec ?? 180,
        // Owner decision S: score games are judged on their score against the typical one (Library page).
        GAME_BY_ID[r.game_id]?.scoring === "score" ? meta[r.game_id]?.typicalScore : null,
      ),
    };
  });
  const done = games.filter((g) => isFinished(g.state)).length;
  return {
    enabled: true,
    ...base,
    games,
    done,
    total: games.length,
    score: games.reduce((t, g) => t + g.points, 0),
    complete: games.length > 0 && done === games.length,
  };
}

/**
 * After a finish: the player's Daily Five progress when the attempt was a Daily Five game (else null), so the
 * play screen can send them on to the next game and record the completion once.
 */
export async function fiveProgressAfter(db: SupabaseClient, playerId: string, attemptId: string) {
  const { data } = await db.from("attempts").select("daily_five, daily_date").eq("id", attemptId).maybeSingle();
  if (!data?.daily_five || !data.daily_date) return null;
  const v = await loadDailyFive(playerId, db);
  if (v.date !== data.daily_date) return null;
  const next = v.games.find((g) => !isFinished(g.state));
  return { done: v.done, total: v.total, score: v.score, complete: v.complete, next: next ? { game: next.game, slot: next.slot } : null };
}

/* ---------------- Admin scheduler ---------------- */

export interface AdminDay {
  date: string;
  rows: FiveRow[];
  /** not stored yet: what the auto-pick will choose under today's rules */
  preview: boolean;
  locked: boolean;
  source: "auto" | "manual" | null;
  /** Daily Five attempts already made that day (a day with attempts keeps its games) */
  attempts: number;
}

export async function adminDays(db: SupabaseClient, from: string, to: string): Promise<AdminDay[]> {
  const s = await getGameSettings();
  const rules = rulesFrom(s);
  const candidates = await fiveCandidates(s);
  const today = fiveDate(new Date(), rules.resetHour);
  const [{ data, error }, { data: played }] = await Promise.all([
    db
      .from("daily_five")
      .select(`${COLS}, puzzles!daily_five_puzzle_id_fkey(difficulty)`)
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("slot"),
    db.from("attempts").select("daily_date").eq("daily_five", true).gte("daily_date", from).lte("daily_date", to).limit(20_000),
  ]);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const a of played ?? []) counts.set(a.daily_date as string, (counts.get(a.daily_date as string) ?? 0) + 1);
  const byDate = new Map<string, FiveRow[]>();
  for (const r of (data ?? []) as unknown as (FiveRow & { puzzles?: { difficulty: string } | null })[])
    byDate.set(r.date, [...(byDate.get(r.date) ?? []), { ...r, difficulty: r.puzzles?.difficulty }]);
  const out: AdminDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const rows = byDate.get(d) ?? [];
    const preview = !rows.length;
    const shown: FiveRow[] = preview
      ? d >= today
        ? pickFive(d, rules, candidates).map((p) => ({
            date: d,
            slot: p.slot,
            kind: p.kind,
            world: p.world,
            game_id: p.game,
            puzzle_id: "",
            source: "auto",
            locked: false,
            difficulty: rules.difficulty,
          }))
        : []
      : rows;
    out.push({
      date: d,
      rows: shown,
      preview,
      locked: rows.some((r) => r.locked),
      source: preview ? null : rows.every((r) => r.source === "manual") ? "manual" : "auto",
      attempts: counts.get(d) ?? 0,
    });
  }
  return out;
}

/** Refuses changes to a day players already reached, a past day, or a locked day. */
async function assertEditable(db: SupabaseClient, date: string, today: string) {
  if (date < today) throw new ApiError(409, "past_day", "Past days stay as they were played.");
  const rows = await readDay(db, date);
  if (rows.some((r) => r.locked)) throw new ApiError(409, "locked", "This day is locked. Unlock it first.");
  const { count } = await db.from("attempts").select("id", { count: "exact", head: true }).eq("daily_five", true).eq("daily_date", date);
  if (count) throw new ApiError(409, "already_played", "Players have started this day's five, so its games stay.");
  return rows;
}

/** Admin: re-run the auto-pick for a day under today's rules. */
export async function adminAutoPick(db: SupabaseClient, date: string, actor: string) {
  const s = await getGameSettings();
  const rules = rulesFrom(s);
  const before = await assertEditable(db, date, fiveDate(new Date(), rules.resetHour));
  const picks = pickFive(date, rules, await fiveCandidates(s));
  const rows = await writeDay(db, date, picks, rules.difficulty, "auto", actor, true);
  return { before: before.map((r) => r.game_id), after: rows.map((r) => r.game_id) };
}

/** Admin: pick a day's five games by hand (order = slot order). */
export async function adminManualPick(db: SupabaseClient, date: string, games: string[], actor: string) {
  const s = await getGameSettings();
  const rules = rulesFrom(s);
  if (games.length !== FIVE_SLOTS || new Set(games).size !== FIVE_SLOTS)
    throw new ApiError(422, "five_games", `Pick ${FIVE_SLOTS} different games.`);
  for (const g of games) if (!schedulableGame(g, s)) throw new ApiError(422, "unknown_game", `${g} cannot be scheduled.`);
  const before = await assertEditable(db, date, fiveDate(new Date(), rules.resetHour));
  const picks = slotsFor(games.map((id) => ({ id, world: GAME_BY_ID[id].world })));
  const rows = await writeDay(db, date, picks, rules.difficulty, "manual", actor, true);
  return { before: before.map((r) => r.game_id), after: rows.map((r) => r.game_id) };
}

/** Admin: lock or unlock a day. Locking a day that is only a preview stores its auto-pick first. */
export async function adminLock(db: SupabaseClient, date: string, locked: boolean, actor: string) {
  const s = await getGameSettings();
  const today = fiveDate(new Date(), rulesFrom(s).resetHour);
  if (date < today) throw new ApiError(409, "past_day", "Past days stay as they were played.");
  if (locked) await ensureDay(db, date, s);
  const { data, error } = await db
    .from("daily_five")
    .update(
      locked
        ? { locked: true, locked_at: new Date().toISOString(), locked_by: actor }
        : { locked: false, locked_at: null, locked_by: null },
    )
    .eq("date", date)
    .select("slot");
  if (error) throw error;
  if (!data?.length) throw new ApiError(404, "day_not_found");
  return { slots: data.length };
}

/** Admin export: stored days from..to as schedule rows (game ids in slot order). */
export async function exportDays(db: SupabaseClient, from: string, to: string): Promise<ScheduleDay[]> {
  const { data, error } = await db.from("daily_five").select(COLS).gte("date", from).lte("date", to).order("date").order("slot");
  if (error) throw error;
  const by = new Map<string, ScheduleDay>();
  for (const r of (data ?? []) as FiveRow[]) {
    const d = by.get(r.date) ?? { date: r.date, games: [], locked: false };
    d.games.push(r.game_id);
    d.locked = d.locked || r.locked;
    by.set(r.date, d);
  }
  return [...by.values()];
}

/**
 * Admin import: each day becomes a manual pick (and is locked when the file says so). Days that cannot change
 * (past, locked, already played) are skipped and reported; the others are saved.
 */
export async function importDays(db: SupabaseClient, days: ScheduleDay[], actor: string) {
  const saved: string[] = [];
  const skipped: { date: string; reason: string }[] = [];
  for (const d of days) {
    try {
      await adminManualPick(db, d.date, d.games, actor);
      if (d.locked) await adminLock(db, d.date, true, actor);
      saved.push(d.date);
    } catch (e) {
      if (e instanceof ApiError) skipped.push({ date: d.date, reason: e.code });
      else throw e;
    }
  }
  return { saved, skipped };
}
