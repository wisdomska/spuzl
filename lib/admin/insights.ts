/**
 * Admin Metrics, owner view (admin overhaul B): the cards that answer "how many play, do they come back, what do
 * they play, together, Sparks and shop, community, first time". Pure, so the page, the CSV route and the tests share
 * one definition of every number. Words live in lib/copy/admin.ts (metrics.cards); the SQL is
 * private.admin_insights (20261211020101) merged into svc_admin_metrics.
 */
import { addDays, ISO_DATE } from "./dates";
import { csvCell, rate, type MetricRow, type MetricsData } from "./metrics";
import { GAME_BY_ID, MERGED_WORLDS, WORLD_BY_ID, type WorldId } from "@/lib/catalog";

export { count, duration, percent } from "./format";

export const INSIGHT_SECTIONS = ["people", "return", "play", "together", "economy", "community", "first"] as const;
export type InsightSection = (typeof INSIGHT_SECTIONS)[number];

export const INSIGHT_IDS = [
  "players",
  "new_players",
  "saved_accounts",
  "next_day",
  "week_later",
  "streaks",
  "games_played",
  "daily_puzzles",
  "daily_five_plays",
  "duels_played",
  "parties",
  "board_games",
  "friends",
  "sparks_earned",
  "sparks_spent",
  "shop_buys",
  "reports",
  "feedback",
  "onboarding_done",
  "first_game",
  "practice_done",
  "top_games",
] as const;
export type InsightId = (typeof INSIGHT_IDS)[number];
export const isInsightId = (id: string): id is InsightId => (INSIGHT_IDS as readonly string[]).includes(id);

export type InsightFormat = "count" | "percent";
/** Which way is good news: up (more players), or neither (reports: more can mean more people care). */
export type Better = "up" | "neutral";

type CsvCol = { key: string; value: (r: MetricRow) => number | null };
export interface InsightDef {
  id: Exclude<InsightId, "top_games">;
  section: InsightSection;
  format: InsightFormat;
  /** The big number for a range total, and each day's point on the trend. Null = nothing to measure. */
  value: (r: MetricRow) => number | null;
  better: Better;
  /** A count of right now (streaks): no trend, no comparison. */
  snapshot?: boolean;
  csv: CsvCol[];
}

const z = (v: number | undefined) => v ?? 0;
export const plays = (r: MetricRow) => z(r.puzzles_started) + z(r.board_plays);
export const guests = (r: MetricRow) => Math.max(0, z(r.active) - z(r.active_saved));
export const nextDay = (r: MetricRow) => rate(z(r.rt_d1_kept), z(r.rt_d1_cohort));
export const weekLater = (r: MetricRow) => rate(z(r.rt_d7_kept), z(r.rt_d7_cohort));
/** Practice rounds that showed but were neither solved nor skipped. Never below 0. */
export const practiceLeft = (r: MetricRow) => Math.max(0, z(r.practice_started) - z(r.practice_finished) - z(r.practice_skipped));

export const INSIGHTS: readonly InsightDef[] = [
  {
    id: "players",
    section: "people",
    format: "count",
    value: (r) => z(r.active),
    better: "up",
    csv: [
      { key: "players", value: (r) => z(r.active) },
      { key: "saved_account", value: (r) => z(r.active_saved) },
      { key: "guests", value: guests },
    ],
  },
  {
    id: "new_players",
    section: "people",
    format: "count",
    value: (r) => r.created,
    better: "up",
    csv: [
      { key: "new_players", value: (r) => r.created },
      { key: "saved_account_now", value: (r) => z(r.new_saved) },
    ],
  },
  {
    id: "saved_accounts",
    section: "people",
    format: "percent",
    value: (r) => rate(z(r.active_saved), z(r.active)),
    better: "up",
    csv: [
      { key: "players", value: (r) => z(r.active) },
      { key: "saved_account", value: (r) => z(r.active_saved) },
      { key: "saved_pct", value: (r) => rate(z(r.active_saved), z(r.active)) },
    ],
  },
  {
    id: "next_day",
    section: "return",
    format: "percent",
    value: nextDay,
    better: "up",
    csv: [
      { key: "first_played_day_before", value: (r) => z(r.rt_d1_cohort) },
      { key: "came_back", value: (r) => z(r.rt_d1_kept) },
      { key: "came_back_pct", value: nextDay },
    ],
  },
  {
    id: "week_later",
    section: "return",
    format: "percent",
    value: weekLater,
    better: "up",
    csv: [
      { key: "first_played_7_days_before", value: (r) => z(r.rt_d7_cohort) },
      { key: "came_back", value: (r) => z(r.rt_d7_kept) },
      { key: "came_back_pct", value: weekLater },
    ],
  },
  {
    id: "streaks",
    section: "return",
    format: "count",
    value: (r) => z(r.streak_3),
    better: "up",
    snapshot: true,
    csv: [
      { key: "streak_3_plus_now", value: (r) => z(r.streak_3) },
      { key: "streak_7_plus_now", value: (r) => z(r.streak_7) },
    ],
  },
  {
    id: "games_played",
    section: "play",
    format: "count",
    value: plays,
    better: "up",
    csv: [
      { key: "games_played", value: plays },
      { key: "puzzles_started", value: (r) => z(r.puzzles_started) },
      { key: "puzzles_solved", value: (r) => z(r.puzzles_cleared) },
      { key: "board_game_plays", value: (r) => z(r.board_plays) },
    ],
  },
  {
    id: "daily_puzzles",
    section: "play",
    format: "count",
    value: (r) => r.daily_cleared,
    better: "up",
    csv: [
      { key: "daily_started", value: (r) => r.daily_started },
      { key: "daily_solved", value: (r) => r.daily_cleared },
      { key: "solved_pct", value: (r) => rate(r.daily_cleared, r.daily_started) },
    ],
  },
  {
    id: "daily_five_plays",
    section: "play",
    format: "count",
    value: (r) => z(r.daily5_players),
    better: "up",
    csv: [
      { key: "daily_five_plays", value: (r) => z(r.daily5_players) },
      { key: "played_all_five", value: (r) => z(r.daily5_full) },
    ],
  },
  {
    id: "duels_played",
    section: "together",
    format: "count",
    value: (r) => z(r.duels),
    better: "up",
    csv: [
      { key: "duels", value: (r) => z(r.duels) },
      { key: "against_computer", value: (r) => z(r.duels_vs_computer) },
    ],
  },
  {
    id: "parties",
    section: "together",
    format: "count",
    value: (r) => z(r.parties),
    better: "up",
    csv: [
      { key: "party_games", value: (r) => z(r.parties) },
      { key: "players", value: (r) => z(r.party_players) },
    ],
  },
  {
    id: "board_games",
    section: "together",
    format: "count",
    value: (r) => z(r.board_games),
    better: "up",
    csv: [
      { key: "board_games", value: (r) => z(r.board_games) },
      { key: "with_people", value: (r) => Math.max(0, z(r.board_games) - z(r.board_bot_games)) },
      { key: "against_computer", value: (r) => z(r.board_bot_games) },
    ],
  },
  {
    id: "friends",
    section: "together",
    format: "count",
    value: (r) => z(r.friends_made),
    better: "up",
    csv: [{ key: "new_friendships", value: (r) => z(r.friends_made) }],
  },
  {
    id: "sparks_earned",
    section: "economy",
    format: "count",
    value: (r) => z(r.sparks_earned),
    better: "up",
    csv: [{ key: "sparks_earned", value: (r) => z(r.sparks_earned) }],
  },
  {
    id: "sparks_spent",
    section: "economy",
    format: "count",
    value: (r) => z(r.sparks_spent),
    better: "up",
    csv: [{ key: "sparks_spent", value: (r) => z(r.sparks_spent) }],
  },
  {
    id: "shop_buys",
    section: "economy",
    format: "count",
    value: (r) => z(r.shop_buys),
    better: "up",
    csv: [
      { key: "items_bought", value: (r) => z(r.shop_buys) },
      { key: "buyers", value: (r) => z(r.shop_buyers) },
    ],
  },
  {
    id: "reports",
    section: "community",
    format: "count",
    value: (r) => z(r.reports_sent),
    better: "neutral",
    csv: [{ key: "reports_sent", value: (r) => z(r.reports_sent) }],
  },
  {
    id: "feedback",
    section: "community",
    format: "count",
    value: (r) => z(r.feedback_sent),
    better: "neutral",
    csv: [{ key: "feedback_messages", value: (r) => z(r.feedback_sent) }],
  },
  {
    id: "onboarding_done",
    section: "first",
    format: "percent",
    value: (r) => rate(z(r.onboarding_home), z(r.onboarding_age)),
    better: "up",
    csv: [
      { key: "reached_age_question", value: (r) => z(r.onboarding_age) },
      { key: "reached_home", value: (r) => z(r.onboarding_home) },
      { key: "finished_pct", value: (r) => rate(z(r.onboarding_home), z(r.onboarding_age)) },
    ],
  },
  {
    id: "first_game",
    section: "first",
    format: "percent",
    value: (r) => rate(r.played, r.created),
    better: "up",
    csv: [
      { key: "new_players", value: (r) => r.created },
      { key: "played_a_game", value: (r) => r.played },
      { key: "played_pct", value: (r) => rate(r.played, r.created) },
    ],
  },
  {
    id: "practice_done",
    section: "first",
    format: "percent",
    value: (r) => rate(z(r.practice_finished), z(r.practice_started)),
    better: "up",
    csv: [
      { key: "practice_started", value: (r) => z(r.practice_started) },
      { key: "finished", value: (r) => z(r.practice_finished) },
      { key: "skipped", value: (r) => z(r.practice_skipped) },
      { key: "left_early", value: practiceLeft },
      { key: "finished_pct", value: (r) => rate(z(r.practice_finished), z(r.practice_started)) },
    ],
  },
];

export const INSIGHT_BY_ID = Object.fromEntries(INSIGHTS.map((d) => [d.id, d])) as Record<InsightDef["id"], InsightDef>;

/** The same number of GMT days straight before `from`. */
export function previousRange(from: string, days: number): { from: string; to: string } {
  if (!ISO_DATE.test(from) || !Number.isInteger(days) || days < 1) throw new Error("bad_range");
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

/** Mean of the days that have a value; null when none do (an empty range never divides by zero). */
export function dailyAverage(rows: readonly MetricRow[], value: (r: MetricRow) => number | null): number | null {
  const v = rows.map(value).filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export interface Change {
  dir: "up" | "down" | "same";
  /** Percent change for counts, percentage points for percentages; null when the earlier period had none. */
  amount: number | null;
  unit: "percent" | "points";
}

/**
 * Change against the previous period. Counts: whole percent change ("none before" when it was 0 and is not now).
 * Percentages: whole percentage points. Null when either side has nothing to compare.
 */
export function change(cur: number | null, prev: number | null | undefined, format: InsightFormat): Change | null {
  if (cur === null || prev === null || prev === undefined) return null;
  if (format === "percent") {
    const pts = Math.round(cur - prev);
    return { dir: pts > 0 ? "up" : pts < 0 ? "down" : "same", amount: Math.abs(pts), unit: "points" };
  }
  if (prev === 0) return cur === 0 ? { dir: "same", amount: 0, unit: "percent" } : { dir: "up", amount: null, unit: "percent" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { dir: pct > 0 ? "up" : pct < 0 ? "down" : "same", amount: Math.abs(pct), unit: "percent" };
}

/** Good, bad or neither, for colouring a change (always shown with words and an arrow too). */
export const changeTone = (c: Change | null, better: Better): "good" | "bad" | "neutral" =>
  !c || c.dir === "same" || better === "neutral" ? "neutral" : c.dir === "up" ? "good" : "bad";

/**
 * Trend line points in a 0..100 by 0..H box, oldest day first. Days without a value (null) break the line, so a
 * gap never reads as a zero. Returns the line segments as SVG "x,y" lists.
 */
export function sparkline(values: readonly (number | null)[], h = 28): string[] {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!nums.length) return [];
  const max = Math.max(...nums);
  const min = Math.min(0, ...nums);
  const span = max - min || 1;
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  const segs: string[] = [];
  let cur: string[] = [];
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      if (cur.length) segs.push(cur.join(" "));
      cur = [];
      return;
    }
    const x = values.length > 1 ? i * step : 50;
    const y = h - ((v - min) / span) * (h - 2) - 1;
    cur.push(`${+x.toFixed(2)},${+y.toFixed(2)}`);
  });
  if (cur.length) segs.push(cur.join(" "));
  return segs;
}

/** The busiest and quietest day of a trend (first one wins a tie), for the screen-reader summary. */
export function extremes(rows: readonly MetricRow[], value: (r: MetricRow) => number | null) {
  let hi: { date: string; v: number } | null = null;
  let lo: { date: string; v: number } | null = null;
  for (const r of rows) {
    const v = value(r);
    if (v === null || !r.date) continue;
    if (!hi || v > hi.v) hi = { date: r.date, v };
    if (!lo || v < lo.v) lo = { date: r.date, v };
  }
  return { hi, lo };
}

export interface GamePlays {
  id: string;
  name: string;
  world: WorldId | null;
  plays: number;
  players: number;
  prevPlays: number;
}

/** Games by plays in the range (busiest first, then by name), with the previous period's plays. */
export function topGames(t: MetricRow, prev?: MetricRow): GamePlays[] {
  const before = prev?.top_games ?? {};
  return Object.entries(t.top_games ?? {})
    .map(([id, c]) => ({
      id,
      name: GAME_BY_ID[id]?.name ?? id,
      world: worldOf(id),
      plays: c.plays,
      players: c.players,
      prevPlays: before[id]?.plays ?? 0,
    }))
    .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name));
}

/** A game's world today (retired worlds folded into the one that took their games). */
export function worldOf(gameId: string): WorldId | null {
  const w = GAME_BY_ID[gameId]?.world;
  if (!w) return null;
  return MERGED_WORLDS[w] ?? w;
}

export interface WorldPlays {
  id: WorldId | "other";
  name: string | null;
  plays: number;
  /** Share of all plays, as a percentage with one decimal (null when there were no plays). */
  share: number | null;
}

/** Plays per world, busiest first. Games the catalog no longer knows go under "other". */
export function worldPlays(t: MetricRow): WorldPlays[] {
  const by = new Map<WorldId | "other", number>();
  let all = 0;
  for (const [id, c] of Object.entries(t.top_games ?? {})) {
    const w = worldOf(id) ?? "other";
    by.set(w, (by.get(w) ?? 0) + c.plays);
    all += c.plays;
  }
  return [...by.entries()]
    .map(([id, n]) => ({ id, name: id === "other" ? null : (WORLD_BY_ID[id]?.name ?? id), plays: n, share: rate(n, all) }))
    .sort((a, b) => b.plays - a.plays || String(a.name).localeCompare(String(b.name)));
}

/** CSV for one owner card: header, one row per day, then the range total. Top games: one row per game. */
export function insightCsv(id: InsightId, data: Pick<MetricsData, "rows" | "total">): string {
  if (id === "top_games") {
    const lines = ["game,world,plays,players"];
    for (const g of topGames(data.total)) lines.push([g.id, g.world ?? "", g.plays, g.players].map(csvCell).join(","));
    return lines.join("\r\n") + "\r\n";
  }
  const def = INSIGHT_BY_ID[id];
  const lines = [["date", ...def.csv.map((c) => c.key)].join(",")];
  if (!def.snapshot) for (const r of data.rows) lines.push([r.date ?? "", ...def.csv.map((c) => c.value(r))].map(csvCell).join(","));
  lines.push([def.snapshot ? "now" : "total", ...def.csv.map((c) => c.value(data.total))].map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}
