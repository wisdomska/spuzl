/**
 * Daily Five (R2-05): five short shared puzzles a day, the same for everyone. Pure rules shared by the server
 * (scheduling, scoring), the client (Home card, /daily, share grid) and the admin console (scheduler, JSON).
 *
 * - One game per visible world (Puzzles, Words & Quiz, Arcade, Board Games) plus a rotating bonus, chosen from
 *   live games whose typical time is quick. A world switched off in settings hands its slot to another bonus.
 * - Deterministic per date: the same date and rules always give the same five (no randomness, no clock).
 * - A day runs from the reset hour (GMT) to the same hour the next day.
 */
import type { WorldId } from "@/lib/catalog";
import { dailyNumber, formatShort } from "@/lib/format";
import { SHARE_DOMAIN, WORLD_EMOJI } from "@/lib/share/text";
import { dailyFiveCopy as T } from "@/lib/copy/daily-five";
import type { GameSettings } from "@/lib/game-settings/schema";

/** The visible worlds, in Home map order. Each gets one slot (when switched on). */
export const FIVE_WORLDS = ["logic", "word", "reflex", "board"] as const satisfies readonly WorldId[];
export type FiveWorld = (typeof FIVE_WORLDS)[number];
export const FIVE_SLOTS = 5;
/** Points for one game, and for all five. */
export const MAX_POINTS = 200;
export const MAX_SCORE = MAX_POINTS * FIVE_SLOTS;
export const FIVE_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type FiveDifficulty = (typeof FIVE_DIFFICULTIES)[number];

export const isFiveWorld = (w: string): w is FiveWorld => (FIVE_WORLDS as readonly string[]).includes(w);

export interface FiveRules {
  worlds: Record<FiveWorld, boolean>;
  bonus: Record<FiveWorld, boolean>;
  difficulty: FiveDifficulty;
  maxGameSec: number;
  resetHour: number;
  daysAhead: number;
}

/** The composition rules from the admin game settings (lib/game-settings/schema.ts, group "Daily Five"). */
export function rulesFrom(s: GameSettings): FiveRules {
  const d = s["dailyFive.difficulty"];
  return {
    worlds: {
      logic: s["dailyFive.world.logic"],
      word: s["dailyFive.world.word"],
      reflex: s["dailyFive.world.reflex"],
      board: s["dailyFive.world.board"],
    },
    bonus: {
      logic: s["dailyFive.bonus.logic"],
      word: s["dailyFive.bonus.word"],
      reflex: s["dailyFive.bonus.reflex"],
      board: s["dailyFive.bonus.board"],
    },
    difficulty: (FIVE_DIFFICULTIES as readonly string[]).includes(d) ? (d as FiveDifficulty) : "easy",
    maxGameSec: s["dailyFive.maxGameSec"],
    resetHour: s["dailyFive.resetHour"],
    daysAhead: s["dailyFive.daysAhead"],
  };
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** The Daily Five day at `now`: the GMT date of `now` minus the reset hour. */
export function fiveDate(now: Date = new Date(), resetHour = 0): string {
  return new Date(now.getTime() - resetHour * HOUR).toISOString().slice(0, 10);
}

/**
 * R4-07: an offline Daily clear synced later counts only when it was finished within its day. A Daily Five attempt's
 * day is the Daily Five day (from the reset hour), so it is checked against that too; the regular Daily's is the GMT
 * date. A Daily Five game opened as the regular Daily before the reset hour carries the GMT date, so either fits.
 */
export function offlineInDay(finishedAt: Date, dailyDate: string, dailyFive: boolean, resetHour = 0): boolean {
  if (finishedAt.toISOString().slice(0, 10) === dailyDate) return true;
  return dailyFive && fiveDate(finishedAt, resetHour) === dailyDate;
}

/** ms until the next Daily Five opens. */
export function msToFiveReset(now: Date = new Date(), resetHour = 0): number {
  const next = Date.parse(fiveDate(now, resetHour) + "T00:00:00Z") + DAY + resetHour * HOUR;
  return next - now.getTime();
}

/** FNV-1a, 32 bit: a stable small hash for spreading worlds across their games. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Candidate {
  id: string;
  world: WorldId;
  /** typical seconds (Library metadata, admin overridable) */
  typicalSec: number;
}

export interface FivePick {
  slot: number;
  kind: "world" | "bonus";
  world: WorldId;
  game: string;
}

/** The quick games of a list (typical time within the limit); none quick enough: the quickest ones. */
function quick(list: Candidate[], maxSec: number): Candidate[] {
  const q = list.filter((c) => c.typicalSec <= maxSec);
  if (q.length || !list.length) return q;
  const min = Math.min(...list.map((c) => c.typicalSec));
  return list.filter((c) => c.typicalSec === min);
}

/**
 * The five for `date` under `rules`, from `candidates` (live games that can be scheduled). World slots come
 * first in map order, then bonus slots. Each world rotates through its quick games one day at a time (so a
 * game never repeats on consecutive days while its world has two or more); the bonus rotates through the
 * bonus-pool worlds, never repeating a game already in the five. Fewer than five only when there are fewer
 * than five candidates.
 */
export function pickFive(date: string, rules: FiveRules, candidates: readonly Candidate[]): FivePick[] {
  const day = dailyNumber(date);
  const all = [...new Map(candidates.map((c) => [c.id, c])).values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const picks: Omit<FivePick, "slot">[] = [];
  for (const w of FIVE_WORLDS) {
    if (!rules.worlds[w] || picks.length >= FIVE_SLOTS) continue;
    const list = quick(
      all.filter((c) => c.world === w),
      rules.maxGameSec,
    );
    if (!list.length) continue;
    const i = (day + (hash32(`world:${w}`) % list.length)) % list.length;
    picks.push({ kind: "world", world: w, game: list[i].id });
  }
  const used = new Set(picks.map((p) => p.game));
  const chosen = FIVE_WORLDS.filter((w) => rules.bonus[w]);
  const poolWorlds: readonly FiveWorld[] = chosen.length ? chosen : FIVE_WORLDS;
  for (let k = 0; picks.length < FIVE_SLOTS; k++) {
    const left = all.filter((c) => !used.has(c.id));
    if (!left.length || k > 4 * FIVE_SLOTS) break;
    // The bonus world rotates day by day through the pool; its game rotates every full turn of the pool.
    const w = poolWorlds[(day + k) % poolWorlds.length];
    let pool = quick(
      left.filter((c) => c.world === w),
      rules.maxGameSec,
    );
    if (!pool.length)
      pool = quick(
        left.filter((c) => (poolWorlds as readonly string[]).includes(c.world)),
        rules.maxGameSec,
      );
    if (!pool.length) pool = quick(left, rules.maxGameSec);
    const turn = Math.floor(day / poolWorlds.length);
    const g = pool[(turn + (hash32(`bonus:${w}:${k}`) % pool.length)) % pool.length];
    used.add(g.id);
    picks.push({ kind: "bonus", world: g.world, game: g.id });
  }
  return picks.map((p, i) => ({ ...p, slot: i + 1 }));
}

/**
 * R4-06: new games for the slots of a stored day whose game can no longer be played (a lab game switched off).
 * Each such slot keeps its number and gets a quick game of the same world that is not already in the day (and its
 * kind), else one from the bonus pool, else any quick game left (as a bonus), rotating by date so the choice is
 * deterministic.
 * Only the changed slots are returned; a slot with no game left to take is left out (and stays as it was).
 */
export function replaceSlots(
  date: string,
  rows: readonly { slot: number; kind: "world" | "bonus"; world: WorldId; game: string }[],
  closed: (id: string) => boolean,
  rules: FiveRules,
  candidates: readonly Candidate[],
): FivePick[] {
  const day = dailyNumber(date);
  const all = [...new Map(candidates.map((c) => [c.id, c])).values()]
    .filter((c) => !closed(c.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const used = new Set(rows.map((r) => r.game));
  const chosen = FIVE_WORLDS.filter((w) => rules.bonus[w]);
  const poolWorlds: readonly string[] = chosen.length ? chosen : FIVE_WORLDS;
  const out: FivePick[] = [];
  for (const r of [...rows].sort((a, b) => a.slot - b.slot)) {
    if (!closed(r.game)) continue;
    const left = all.filter((c) => !used.has(c.id));
    let pool = quick(
      left.filter((c) => c.world === r.world),
      rules.maxGameSec,
    );
    if (!pool.length)
      pool = quick(
        left.filter((c) => poolWorlds.includes(c.world)),
        rules.maxGameSec,
      );
    if (!pool.length) pool = quick(left, rules.maxGameSec);
    if (!pool.length) continue;
    const g = pool[(day + (hash32(`swap:${r.slot}`) % pool.length)) % pool.length];
    used.add(g.id);
    out.push({ slot: r.slot, kind: g.world === r.world ? r.kind : "bonus", world: g.world, game: g.id });
  }
  return out;
}

/**
 * Slots for a manual pick (admin scheduler or JSON import), in the order given: the first game of each world
 * holds that world's slot, any further game is a bonus.
 */
export function slotsFor(games: readonly { id: string; world: WorldId }[]): FivePick[] {
  const seen = new Set<string>();
  return games.map((g, i) => {
    const kind = isFiveWorld(g.world) && !seen.has(g.world) ? "world" : "bonus";
    seen.add(g.world);
    return { slot: i + 1, kind, world: g.world, game: g.id };
  });
}

/* ---------------- Scoring ---------------- */

export type FiveState = "new" | "in_progress" | "cleared" | "failed" | "flagged";
export const isFinished = (s: FiveState) => s === "cleared" || s === "failed" || s === "flagged";

/**
 * Points for one Daily Five game, 0..200, computed on the server from the verified attempt. A clear earns 100
 * plus a speed bonus up to 100 (full at 0 s, half at the game's typical time, none at twice it), less 15 per
 * hint and 5 per mistake, never below 50. A miss earns 0; a flagged (too fast) clear earns 0 until a moderator
 * clears it, when it counts like any clear.
 *
 * Score games (owner decision S): a game scored on points rather than time (Quickfire, Echo, Beat Tap...) with a
 * typical score (`typicalScore`, admin-tunable on the Library page) earns its bonus from its own score instead: none
 * at 0, half at the typical score, full at twice it. Without a typical score, or before the score is known, time
 * is the measure, so every game's points sit on the same 50..200 scale and add up fairly.
 */
export function fivePoints(
  r: { state: FiveState; timeMs?: number | null; hints?: number; mistakes?: number; score?: number | null },
  typicalSec: number,
  typicalScore?: number | null,
): number {
  if (r.state !== "cleared") return 0;
  const bonus =
    typicalScore && typicalScore > 0 && typeof r.score === "number" ? scoreBonus(r.score, typicalScore) : timeBonus(r.timeMs, typicalSec);
  const raw = 100 + bonus - 15 * (r.hints ?? 0) - 5 * (r.mistakes ?? 0);
  return Math.min(MAX_POINTS, Math.max(50, raw));
}

/** 0..100: full at 0 s, half at the typical time, none at twice it. */
function timeBonus(timeMs: number | null | undefined, typicalSec: number): number {
  const par = Math.max(10, typicalSec) * 1000;
  const t = Math.max(0, timeMs ?? par);
  return Math.round(Math.min(100, Math.max(0, (100 * (2 * par - t)) / (2 * par))));
}

/** 0..100: none at a score of 0, half at the typical score, full at twice it or more. */
export function scoreBonus(score: number, typicalScore: number): number {
  return Math.round(Math.min(100, Math.max(0, (100 * score) / (2 * typicalScore))));
}

/* ---------------- Share grid ---------------- */

export interface ShareRow {
  world: WorldId;
  name: string;
  state: FiveState;
  timeMs?: number | null;
  points: number;
}

/**
 * Spoiler-free text grid, one row per game: world-colour squares for the points (one per 40, five for a
 * perfect game), white for the rest, black for a miss, then the game and its time. No answers, no names.
 *
 *   SPUZL Daily Five #220 · 845/1000
 *   🟦🟦🟦🟦⬜ Crownfall 1:12
 *   🟩🟩🟩⬜⬜ Remix 0:48
 *   ⬛⬛⬛⬛⬛ Echo missed
 *   spuzl.vercel.app/daily
 */
export function shareGrid(i: { date: string; score: number; rows: readonly ShareRow[]; url?: string }): string {
  const lines = [T.shareHead(dailyNumber(i.date), i.score, MAX_SCORE)];
  for (const r of i.rows) {
    const n = Math.max(0, Math.min(5, Math.round(r.points / 40)));
    const squares = r.state === "cleared" ? WORLD_EMOJI[r.world].repeat(n) + "⬜".repeat(5 - n) : "⬛".repeat(5);
    const tail =
      r.state === "cleared" ? (r.timeMs != null ? formatShort(r.timeMs) : "") : r.state === "flagged" ? T.shareCheck : T.shareMissed;
    lines.push(`${squares} ${r.name}${tail ? ` ${tail}` : ""}`);
  }
  lines.push(i.url ?? `${SHARE_DOMAIN}/daily`);
  return lines.join("\n");
}

/* ---------------- Schedule import and export (admin) ---------------- */

export interface ScheduleDay {
  date: string;
  /** game ids in slot order */
  games: string[];
  locked: boolean;
}
export interface ScheduleFile {
  app: "spuzl";
  kind: "daily-five";
  version: 1;
  days: ScheduleDay[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_IMPORT_DAYS = 120;

/** Pretty JSON of a schedule, days in date order (what export downloads and import reads back). */
export function scheduleToJson(days: readonly ScheduleDay[]): string {
  const file: ScheduleFile = {
    app: "spuzl",
    kind: "daily-five",
    version: 1,
    days: [...days].sort((a, b) => (a.date < b.date ? -1 : 1)).map((d) => ({ date: d.date, games: [...d.games], locked: !!d.locked })),
  };
  return JSON.stringify(file, null, 2) + "\n";
}

/**
 * Validates an imported schedule. Every problem is listed (nothing is saved unless all rows pass): a real
 * date, five distinct games each live and schedulable (`isGame`), no date twice, at most 120 days.
 */
export function parseSchedule(
  text: string,
  isGame: (id: string) => boolean,
): { ok: true; days: ScheduleDay[] } | { ok: false; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["Not valid JSON."] };
  }
  const f = raw as Partial<ScheduleFile> | null;
  if (!f || typeof f !== "object" || f.kind !== "daily-five" || f.version !== 1 || !Array.isArray(f.days))
    return { ok: false, errors: ['Not a Daily Five schedule (expected kind "daily-five", version 1 and a days list).'] };
  if (f.days.length > MAX_IMPORT_DAYS) return { ok: false, errors: [`At most ${MAX_IMPORT_DAYS} days per import.`] };
  const errors: string[] = [];
  const seen = new Set<string>();
  const days: ScheduleDay[] = [];
  f.days.forEach((d: Partial<ScheduleDay> | null, i) => {
    const at = `Day ${i + 1}`;
    if (!d || typeof d !== "object") return void errors.push(`${at}: not an object.`);
    const date = typeof d.date === "string" && ISO.test(d.date) && !Number.isNaN(Date.parse(d.date + "T00:00:00Z")) ? d.date : null;
    if (!date) errors.push(`${at}: date must be yyyy-mm-dd.`);
    else if (seen.has(date)) errors.push(`${at}: ${date} appears twice.`);
    else seen.add(date);
    const games = Array.isArray(d.games) ? d.games.filter((g): g is string => typeof g === "string") : [];
    if (!Array.isArray(d.games) || games.length !== FIVE_SLOTS || d.games.length !== FIVE_SLOTS)
      errors.push(`${at}: needs exactly ${FIVE_SLOTS} games.`);
    else if (new Set(games).size !== games.length) errors.push(`${at}: a game appears twice.`);
    for (const g of games) if (!isGame(g)) errors.push(`${at}: unknown or unavailable game "${g.slice(0, 24)}".`);
    if (d.locked !== undefined && typeof d.locked !== "boolean") errors.push(`${at}: locked must be true or false.`);
    if (date) days.push({ date, games, locked: d.locked === true });
  });
  return errors.length ? { ok: false, errors } : { ok: true, days };
}
