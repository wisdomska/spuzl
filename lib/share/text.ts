import { GAME_BY_ID, LAUNCH_IDS, type WorldId } from "@/lib/catalog";
import { formatNumber, formatShort } from "@/lib/format";
import { ordinal, type StatusCardModel, type StatusStat } from "./card-model";

/**
 * Spoiler-free share text (FR-RS-03, design "Emoji-grid text format").
 *
 *   SPUZL #214 · Crownfall · 1:12 🔥12
 *   🟩🟩🟩🟩🟩
 *   🟩🟩🟨🟩🟩
 *   spuzl.gg
 *
 * The effort grid is the solve time cut into ten equal slices, five per row: 🟩 clean, 🟨 hint used,
 * 🟥 slip (a mistake or death; it outranks a hint in the same slice), ⬛ not reached. It shows effort,
 * never the answer: no input to these functions carries board state or a solution.
 */

export const SHARE_DOMAIN = "spuzl.gg";

export const CELL = { clean: "🟩", hint: "🟨", slip: "🟥", none: "⬛" } as const;

/** One emoji per world for the Full Spuzl strip (design: 🟪🟪🟪🟦🟦🟧🟨🟩🟩🟩🟩🟥🔷🔴🔴). */
export const WORLD_EMOJI: Record<WorldId, string> = {
  logic: "🟪",
  line: "🟦",
  shape: "🟧",
  number: "🟨",
  word: "🟩",
  clue: "🟥",
  reflex: "🔷",
  rage: "🔴",
  board: "🟫",
};

const GRID_CELLS = 10;
const ROW = 5;

export interface Effort {
  /** active solve time */
  timeMs: number;
  hints?: number;
  /** mistakes, or deaths for Rage Ridge games */
  slips?: number;
  /** when each hint was used (ms into the solve); without it hints are spread evenly */
  hintsAtMs?: number[];
  slipsAtMs?: number[];
  /** share of the puzzle reached, 0..1 (1 for a clear) */
  reached?: number;
}

/** Spread n events evenly over the slices (deterministic, so the same result always shares the same grid). */
function spread(n: number): number[] {
  return Array.from({ length: Math.max(0, n) }, (_, k) => Math.min(GRID_CELLS - 1, Math.floor(((k + 0.5) * GRID_CELLS) / n)));
}

function slicesOf(times: number[] | undefined, count: number, total: number): number[] {
  if (times && times.length) {
    return times.map((t) => (total <= 0 ? 0 : Math.min(GRID_CELLS - 1, Math.max(0, Math.floor((t / total) * GRID_CELLS)))));
  }
  return spread(count);
}

/** The effort grid as rows of emoji. */
export function effortGrid(e: Effort): string[] {
  const cells: string[] = Array(GRID_CELLS).fill(CELL.clean);
  for (const i of slicesOf(e.hintsAtMs, e.hints ?? 0, e.timeMs)) cells[i] = CELL.hint;
  for (const i of slicesOf(e.slipsAtMs, e.slips ?? 0, e.timeMs)) cells[i] = CELL.slip;
  const reached = Math.max(0, Math.min(1, e.reached ?? 1));
  const lit = Math.round(reached * GRID_CELLS);
  for (let i = lit; i < GRID_CELLS; i++) cells[i] = CELL.none;
  const rows: string[] = [];
  for (let r = 0; r < GRID_CELLS; r += ROW) rows.push(cells.slice(r, r + ROW).join(""));
  return rows;
}

const streakTag = (streak?: number) => (streak && streak > 0 ? ` 🔥${streak}` : "");

export interface DailyShare extends Effort {
  gameId: string;
  /** Daily number (#214) */
  number: number;
  /** for score games */
  score?: number | null;
  streak?: number;
}

export function dailyShareText(d: DailyShare): string {
  const meta = GAME_BY_ID[d.gameId];
  const name = meta?.name ?? d.gameId;
  const result =
    meta?.scoring === "score" && d.score !== null && d.score !== undefined ? `${formatNumber(d.score)} pts` : formatShort(d.timeMs);
  return [`SPUZL #${d.number} · ${name} · ${result}${streakTag(d.streak)}`, ...effortGrid(d), SHARE_DOMAIN].join("\n");
}

export interface DayShare {
  number: number;
  /** game ids cleared today (any order) */
  cleared: string[];
  totalMs: number;
  streak?: number;
}

/** The day's Dailies as a world-coloured strip in catalog order; ⬛ for any not yet cleared. */
export function fullSpuzlShareText(d: DayShare): string {
  const done = new Set(d.cleared);
  const strip = LAUNCH_IDS.map((id) => (done.has(id) ? WORLD_EMOJI[GAME_BY_ID[id].world] : CELL.none)).join("");
  const n = LAUNCH_IDS.filter((id) => done.has(id)).length;
  const head = n === LAUNCH_IDS.length ? `FULL SPUZL ${n}/${LAUNCH_IDS.length}` : `${n}/${LAUNCH_IDS.length} Dailies`;
  return [`SPUZL #${d.number} · ${head} · ${formatShort(d.totalMs)}${streakTag(d.streak)}`, strip, SHARE_DOMAIN].join("\n");
}

export interface DuelShare {
  gameId: string;
  me: string;
  them: string;
  /** rounds in order, from the sharer's side */
  rounds: ("won" | "lost")[];
  rating?: number | null;
}

export function duelShareText(d: DuelShare): string {
  const name = GAME_BY_ID[d.gameId]?.name ?? "Mix";
  const won = d.rounds.filter((r) => r === "won").length;
  const lost = d.rounds.length - won;
  const strip = d.rounds.map((r) => (r === "won" ? CELL.clean : CELL.slip)).join("");
  const rating = d.rating !== null && d.rating !== undefined ? ` · rating ${formatNumber(Math.round(d.rating))}` : "";
  return [`SPUZL Duel · ${name}`, `${d.me} ${won} - ${lost} ${d.them}`, `${strip}${rating}`, SHARE_DOMAIN].join("\n");
}

export interface PartyShare {
  players: number;
  place: number;
  games: number;
  code?: string | null;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export function partyShareText(p: PartyShare): string {
  const medal = MEDAL[p.place - 1] ?? "🎉";
  const room = p.code ? ` · Room ${p.code}` : "";
  return [
    `SPUZL Party · ${p.players} Spuzlers`,
    `${medal} ${ordinal(p.place)} of ${p.players} · ${p.games} ${p.games === 1 ? "game" : "games"}${room}`,
    SHARE_DOMAIN,
  ].join("\n");
}

/**
 * Status share text, built from the card model so it carries exactly what the image shows (same privacy rules):
 *
 *   SPUZL · Kofi · Solver II
 *   Lv 15 · 🔥 12 days · 23 of 51 games tried
 *   Favourite world: Logic Lab
 *   spuzl.gg
 */
export function statusShareText(m: StatusCardModel): string {
  const by = (id: StatusStat["id"]) => m.stats.find((s) => s.id === id)?.value;
  const level = by("level");
  const streak = by("streak");
  const tried = by("tried");
  const world = by("world");
  const line2 = [level, streak && streak.startsWith("🔥") ? streak : null, tried ? `${tried} games tried` : null]
    .filter(Boolean)
    .join(" · ");
  return [
    ["SPUZL", m.nickname, m.rank?.label].filter(Boolean).join(" · "),
    line2,
    ...(world ? [`Favourite world: ${world}`] : []),
    SHARE_DOMAIN,
  ].join("\n");
}
