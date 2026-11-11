/**
 * Admin Metrics page (admin cascade): the detail and app-speed cards (folded on the page under the owner view in
 * ./insights.ts), rates, percentiles and CSV. Pure and free of server
 * imports, so the /admin UI, the API route and the tests share one definition of every number.
 *
 * The database aggregates (public.svc_admin_metrics): one row per GMT day plus a range total. Percentiles there
 * are percentile_cont; `percentile` below is the same linear interpolation for code and tests.
 */
import { addDays, ISO_DATE, todayIso } from "./dates";
import { duration, percent } from "./format";
import { PROMPT_LABELS, PROMPT_PAIRS, TRIGGER_LABELS } from "@/lib/prompts/ids";
import { GAME_BY_ID } from "@/lib/catalog";

export const RANGE_DAYS = [7, 30] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];

/** One day (or the range total, without `date`) as returned by svc_admin_metrics. */
export interface MetricRow {
  date?: string;
  tap_n: number;
  tap_p50: number | null;
  tap_p95: number | null;
  load_n: number;
  load_p50: number | null;
  load_p95: number | null;
  created: number;
  tutorial_started: number;
  tutorial_cleared: number;
  played: number;
  first_move_n: number;
  first_move_p50: number | null;
  first_move_p95: number | null;
  attempts: number;
  hinted: number;
  hints_used: number;
  hinted_abandoned: number;
  hint_cancels: number;
  duels_started: number;
  duels_abandoned: number;
  duels_matchmade: number;
  duels_bot: number;
  daily_started: number;
  daily_cleared: number;
  shares: number;
  finished_games: number;
  /** First-party onboarding_step counts (20261110000001); 0 on days before the client sent them. */
  onboarding_hello: number;
  onboarding_signin: number;
  onboarding_age: number;
  onboarding_too_young: number;
  onboarding_start: number;
  onboarding_tutorial: number;
  onboarding_nickname: number;
  onboarding_home: number;
  /** Taps on Hint, and go-aheads (direct, or Confirm on the first-hint sheet). */
  hint_requests: number;
  hint_uses: number;
  /** First-party party_first_move (R2-03): ms from a Party round's start to a player's first move; absent before it. */
  party_first_move_n?: number;
  party_first_move_p50?: number | null;
  party_first_move_p95?: number | null;
  /** First-party prompt events (20261130100401); absent from older API rows. */
  prompt_shown?: number;
  prompt_accepted?: number;
  prompt_dismissed?: number;
  /** Per "<prompt>.<trigger>" (lib/prompts/ids.ts). */
  prompts?: Record<string, PromptCounts>;
  /** R2-02: duels created, by kind and the creator's age band (server recorded duel_created; 20261130100201). */
  duels_friend_1315?: number;
  duels_friend_1617?: number;
  duels_friend_18?: number;
  duels_quick_1315?: number;
  duels_quick_1617?: number;
  duels_quick_18?: number;
  /** Daily Five (20261130100501): first-party daily5_* events, plus players and full fives from attempts. */
  daily5_starts?: number;
  daily5_completes?: number;
  daily5_shares?: number;
  daily5_players?: number;
  daily5_full?: number;
  /** R2-ADMIN (20261202000301): tap_to_board split by the page session's first board (cold) and later ones (warm). */
  cold_n?: number;
  cold_p50?: number | null;
  cold_p95?: number | null;
  warm_n?: number;
  warm_p50?: number | null;
  warm_p95?: number | null;
  /** R2-ADMIN (20261202000401): new profiles that day, how many have cleared a board since, and the time to it. */
  fc_cohort?: number;
  fc_cleared?: number;
  fc_p50?: number | null;
  fc_p95?: number | null;
  /** R2-ADMIN (20261202000501): practice rounds started, solved and skipped (first party), and per game. */
  practice_started?: number;
  practice_finished?: number;
  practice_skipped?: number;
  practice_games?: Record<string, PracticeCounts>;
  /**
   * R2-ADMIN (20261202000601): D1 and D7 retention by cohort day (first attempt or, since R4-11, Board Bay move that day). A day's D1 (D7) cohort is
   * 0 until the day after (7 days after) is over.
   */
  ret_cohort?: number;
  ret_d1_cohort?: number;
  ret_d1_kept?: number;
  ret_d7_cohort?: number;
  ret_d7_kept?: number;
  /** R2-ADMIN (20261202000701): full games ended (game_over), with people (bay) or the bot, by the player's outcome. */
  go_bay_won?: number;
  go_bay_lost?: number;
  go_bay_draw?: number;
  go_bot_won?: number;
  go_bot_lost?: number;
  go_bot_draw?: number;
  /** R2-P5 (20261204000701): Party TV views and sign-in streak shields granted. */
  gr_tv_views?: number;
  gr_shields?: number;
  /** R3-09 (20261207000901): streak nudges delivered, and how many of those players cleared a board within 3 h. */
  sn_sent?: number;
  sn_cleared?: number;
  /** R3-10 (20261207001001): weekly recap cards shown, shared, Play tapped and closed (client recorded). */
  wr_shown?: number;
  wr_shared?: number;
  wr_played?: number;
  wr_dismissed?: number;
  /**
   * Admin overhaul B (20261211020101, private.admin_insights): the owner view. Test players left out, GMT days.
   * active: players who started any game or made a board-game move (range total: each player once); active_saved:
   * of them, with a saved account now; new_saved: new players with a saved account now; rt_*: next-day and
   * week-later return measured on the row's day; the rest are counts of that day (see the migration header).
   */
  active?: number;
  active_saved?: number;
  /** Range total only: players active in the last 7 days of the range. */
  active_last7?: number;
  new_saved?: number;
  rt_d1_cohort?: number;
  rt_d1_kept?: number;
  rt_d7_cohort?: number;
  rt_d7_kept?: number;
  puzzles_started?: number;
  puzzles_cleared?: number;
  board_plays?: number;
  board_games?: number;
  board_bot_games?: number;
  duels?: number;
  duels_vs_computer?: number;
  parties?: number;
  party_players?: number;
  friends_made?: number;
  sparks_earned?: number;
  sparks_spent?: number;
  shop_buys?: number;
  shop_buyers?: number;
  reports_sent?: number;
  feedback_sent?: number;
  /** Range total only, a count of right now: players on a 3+ (7+) day streak. */
  streak_3?: number;
  streak_7?: number;
  /** Range total only: per game id, plays (puzzles started plus board-game plays) and distinct players. */
  top_games?: Record<string, { plays: number; players: number }>;
}

export interface PracticeCounts {
  started: number;
  finished: number;
  skipped: number;
}

export interface PromptCounts {
  shown: number;
  accepted: number;
  dismissed: number;
}

export interface MetricsData {
  from: string;
  to: string;
  days: RangeDays;
  total: MetricRow;
  rows: MetricRow[];
  /** The same number of days straight before `from` (range total only), for "up/down on the days before". */
  previous?: { from: string; to: string; total: MetricRow };
}

/** Linear-interpolated percentile (same as Postgres percentile_cont). p in 0..1. Null for no values. */
export function percentile(values: readonly number[], p: number): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = Math.min(1, Math.max(0, p)) * (v.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

/** Share as a percentage with one decimal, or null when the denominator is 0. */
export function rate(n: number, d: number): number | null {
  return d > 0 ? Math.round((1000 * n) / d) / 10 : null;
}

/** GMT days covered: the `days` days ending on `end` (default today), inclusive. */
export function metricRange(days: RangeDays, end: string = todayIso()): { from: string; to: string } {
  if (!ISO_DATE.test(end)) throw new Error("bad_date");
  return { from: addDays(end, -(days - 1)), to: end };
}

export const METRIC_IDS = [
  "tap_to_board",
  "tap_warmth",
  "first_clear",
  "practice",
  "retention",
  "game_over",
  "onboarding",
  "first_move",
  "party_first_move",
  "hints",
  "duels",
  "duel_bands",
  "daily",
  "shares",
  "prompts",
  "daily_five",
  "growth",
  "streak_nudge",
  "weekly_recap",
] as const;
export type MetricId = (typeof METRIC_IDS)[number];

/** A by-day column; `ms` columns hold milliseconds (shown as "1.2 s", exported raw). */
type Col = { key: string; label: string; value: (r: MetricRow) => number | null; unit?: "ms" };
export interface MetricDef {
  id: MetricId;
  /** Where the card sits on the page: under "More detail", or "App speed (technical)". Both are folded. */
  group: "detail" | "speed";
  title: string;
  /** what the number means and where it comes from */
  note: string;
  /** headline value for the range */
  headline: (t: MetricRow) => string;
  sub: (t: MetricRow) => string;
  cols: Col[];
  /** a table for the range total, one row per item (the prompts card: one row per prompt and trigger) */
  breakdown?: { head: string[]; rows: (t: MetricRow) => { key: string; label: string; values: (number | null)[] }[] };
  /** a CSV other than one row per day (default: `cols` by day, then a total row) */
  csv?: (data: Pick<MetricsData, "rows" | "total">) => string;
}

/** Shown when there is nothing to measure (no data in the range, or a denominator of 0). */
export const NO_DATA = "no data";
const ms = (v: number | null) => duration(v) ?? NO_DATA;
const pct = (v: number | null) => percent(v) ?? NO_DATA;
/** "1.2 s typical", or "no data" when nothing was measured. */
const typical = (v: number | null) => (v === null ? NO_DATA : `${ms(v)} typical`);
const n = (v: number) => v.toLocaleString("en-US");
/**
 * Hint requests that were not used: Cancel on the confirm (requests minus uses), plus `hint_cancel` rows from
 * clients on the older build that sent cancels only. Missing fields (older API rows) count as 0.
 */
export const hintCancels = (r: MetricRow) => Math.max(0, (r.hint_requests ?? 0) - (r.hint_uses ?? 0)) + (r.hint_cancels ?? 0);
const accidental = (r: MetricRow) => rate(r.hinted_abandoned + hintCancels(r), r.hinted + hintCancels(r));
/** Duels created (duel_created), missing fields from older API rows count as 0. */
export const friendDuels = (r: MetricRow) => (r.duels_friend_1315 ?? 0) + (r.duels_friend_1617 ?? 0) + (r.duels_friend_18 ?? 0);
export const quickDuels = (r: MetricRow) => (r.duels_quick_1315 ?? 0) + (r.duels_quick_1617 ?? 0) + (r.duels_quick_18 ?? 0);
const createdDuels = (r: MetricRow) => friendDuels(r) + quickDuels(r);
const under16Duels = (r: MetricRow) => (r.duels_friend_1315 ?? 0) + (r.duels_quick_1315 ?? 0);
/** Onboarding completion: of new players who reached the age step, the share that reached Home. */
const onboarded = (r: MetricRow) => rate(r.onboarding_home ?? 0, r.onboarding_age ?? 0);

/** One prompt and trigger's counts in a row (zeros when it never showed). */
export const promptCounts = (r: MetricRow, prompt: string, trigger: string): PromptCounts => {
  const c = r.prompts?.[`${prompt}.${trigger}`];
  return { shown: c?.shown ?? 0, accepted: c?.accepted ?? 0, dismissed: c?.dismissed ?? 0 };
};
const accepted = (r: MetricRow) => rate(r.prompt_accepted ?? 0, r.prompt_shown ?? 0);

/** Prompts CSV: one row per day and per prompt and trigger, then the range total for each. */
function promptsCsv(data: Pick<MetricsData, "rows" | "total">): string {
  const lines = ["date,prompt,trigger,shown,accepted,dismissed,accept_pct"];
  const add = (date: string, r: MetricRow) => {
    for (const { prompt, trigger } of PROMPT_PAIRS) {
      const c = promptCounts(r, prompt, trigger);
      lines.push([date, prompt, trigger, c.shown, c.accepted, c.dismissed, rate(c.accepted, c.shown)].map(csvCell).join(","));
    }
  };
  for (const r of data.rows) add(r.date ?? "", r);
  add("total", data.total);
  return lines.join("\r\n") + "\r\n";
}

/** D1 and D7 retention of a row's cohort days that are due (null until the later day is over). */
export const d1 = (r: MetricRow) => rate(r.ret_d1_kept ?? 0, r.ret_d1_cohort ?? 0);
export const d7 = (r: MetricRow) => rate(r.ret_d7_kept ?? 0, r.ret_d7_cohort ?? 0);

/** Full games ended against the bot, and the players' win rate there (game_over, R2-ADMIN). */
export const botGames = (r: MetricRow) => (r.go_bot_won ?? 0) + (r.go_bot_lost ?? 0) + (r.go_bot_draw ?? 0);
export const bayGames = (r: MetricRow) => (r.go_bay_won ?? 0) + (r.go_bay_lost ?? 0) + (r.go_bay_draw ?? 0);

/** Practice rounds that showed but were neither solved nor skipped (the player left). Never below 0. */
export const practiceDropped = (c: PracticeCounts) => Math.max(0, c.started - c.finished - c.skipped);
const practiceAll = (r: MetricRow): PracticeCounts => ({
  started: r.practice_started ?? 0,
  finished: r.practice_finished ?? 0,
  skipped: r.practice_skipped ?? 0,
});
/** Per-game practice counts for a row, busiest first (then by id). */
export const practiceGames = (r: MetricRow): [string, PracticeCounts][] =>
  Object.entries(r.practice_games ?? {}).sort((a, b) => b[1].started - a[1].started || a[0].localeCompare(b[0]));

/** Practice CSV: per day, every game seen that day then "all"; then the range total the same way. */
function practiceCsv(data: Pick<MetricsData, "rows" | "total">): string {
  const lines = ["date,game,started,finished,skipped,dropped,finish_pct"];
  const line = (date: string, game: string, c: PracticeCounts) =>
    lines.push([date, game, c.started, c.finished, c.skipped, practiceDropped(c), rate(c.finished, c.started)].map(csvCell).join(","));
  const add = (date: string, r: MetricRow) => {
    for (const [g, c] of practiceGames(r)) line(date, g, c);
    line(date, "all", practiceAll(r));
  };
  for (const r of data.rows) add(r.date ?? "", r);
  add("total", data.total);
  return lines.join("\r\n") + "\r\n";
}

export const METRICS: readonly MetricDef[] = [
  {
    id: "tap_to_board",
    group: "speed",
    title: "Opening a game",
    note: "How long from tapping a game to its board being ready, measured on players' phones. Typical: half of opens are quicker. Slow end: 1 in 20 opens is slower. First load is opening the app straight onto a game.",
    headline: (t) => typical(t.tap_p50),
    sub: (t) => `slow end ${ms(t.tap_p95)} · ${n(t.tap_n)} opens · first load ${ms(t.load_p50)} typical`,
    cols: [
      { key: "tap_count", label: "Opens", value: (r) => r.tap_n },
      { key: "tap_p50_ms", label: "Typical", value: (r) => r.tap_p50, unit: "ms" },
      { key: "tap_p95_ms", label: "Slow end", value: (r) => r.tap_p95, unit: "ms" },
      { key: "load_count", label: "First loads", value: (r) => r.load_n },
      { key: "load_p50_ms", label: "First load typical", value: (r) => r.load_p50, unit: "ms" },
      { key: "load_p95_ms", label: "First load slow end", value: (r) => r.load_p95, unit: "ms" },
    ],
  },
  {
    id: "tap_warmth",
    group: "speed",
    title: "Opening a game: first and later",
    note: "The first game opened in a visit has to download its code, so it is slower; later games in the same visit are quicker. Measured on players' phones (newer app versions only).",
    headline: (t) =>
      t.cold_p50 == null && t.warm_p50 == null ? NO_DATA : `${ms(t.cold_p50 ?? null)} first · ${ms(t.warm_p50 ?? null)} later`,
    sub: (t) =>
      `typical times · slow end ${ms(t.cold_p95 ?? null)} first (${n(t.cold_n ?? 0)} opens), ${ms(t.warm_p95 ?? null)} later (${n(t.warm_n ?? 0)} opens)`,
    cols: [
      { key: "cold_count", label: "First opens", value: (r) => r.cold_n ?? 0 },
      { key: "cold_p50_ms", label: "First typical", value: (r) => r.cold_p50 ?? null, unit: "ms" },
      { key: "cold_p95_ms", label: "First slow end", value: (r) => r.cold_p95 ?? null, unit: "ms" },
      { key: "warm_count", label: "Later opens", value: (r) => r.warm_n ?? 0 },
      { key: "warm_p50_ms", label: "Later typical", value: (r) => r.warm_p50 ?? null, unit: "ms" },
      { key: "warm_p95_ms", label: "Later slow end", value: (r) => r.warm_p95 ?? null, unit: "ms" },
    ],
  },
  {
    id: "first_move",
    group: "speed",
    title: "Time to the first move",
    note: "From a solo puzzle's start (Daily, free play, archive, challenges) to the player's first move. Long times can mean a puzzle is hard to get into.",
    headline: (t) => typical(t.first_move_p50),
    sub: (t) => `slow end ${ms(t.first_move_p95)} · ${n(t.first_move_n)} puzzles`,
    cols: [
      { key: "attempts", label: "Puzzles", value: (r) => r.first_move_n },
      { key: "p50_ms", label: "Typical", value: (r) => r.first_move_p50, unit: "ms" },
      { key: "p95_ms", label: "Slow end", value: (r) => r.first_move_p95, unit: "ms" },
    ],
  },
  {
    id: "party_first_move",
    group: "speed",
    title: "Party start to first move",
    note: "From the end of a Party game's 3-2-1 countdown to each player's first move, on the server clock. One per player per game; coming back into a game already started is not counted again.",
    headline: (t) => typical(t.party_first_move_p50 ?? null),
    sub: (t) => `slow end ${ms(t.party_first_move_p95 ?? null)} · ${n(t.party_first_move_n ?? 0)} first moves`,
    cols: [
      { key: "first_moves", label: "First moves", value: (r) => r.party_first_move_n ?? 0 },
      { key: "p50_ms", label: "Typical", value: (r) => r.party_first_move_p50 ?? null, unit: "ms" },
      { key: "p95_ms", label: "Slow end", value: (r) => r.party_first_move_p95 ?? null, unit: "ms" },
    ],
  },
  {
    id: "first_clear",
    group: "detail",
    title: "New players' first solved puzzle",
    note: "Players who arrived each day, how many have solved a puzzle since (the tutorial does not count), and how long that took from arriving. Recent days keep growing as players come back. Test players left out.",
    headline: (t) => typical(t.fc_p50 ?? null),
    sub: (t) =>
      `slow end ${ms(t.fc_p95 ?? null)} · ${n(t.fc_cleared ?? 0)} of ${n(t.fc_cohort ?? 0)} new players solved one (${pct(rate(t.fc_cleared ?? 0, t.fc_cohort ?? 0))})`,
    cols: [
      { key: "new_players", label: "New players", value: (r) => r.fc_cohort ?? 0 },
      { key: "cleared", label: "Solved one", value: (r) => r.fc_cleared ?? 0 },
      { key: "cleared_pct", label: "Solved %", value: (r) => rate(r.fc_cleared ?? 0, r.fc_cohort ?? 0) },
      { key: "p50_ms", label: "Typical time", value: (r) => r.fc_p50 ?? null, unit: "ms" },
      { key: "p95_ms", label: "Slow end", value: (r) => r.fc_p95 ?? null, unit: "ms" },
    ],
  },
  {
    id: "onboarding",
    group: "detail",
    title: "Getting started, step by step",
    note: "How far new players get through the welcome screens (counted on their phones, once per visit). Finished = reached the home screen, out of those who reached the age question. New profiles, Tutorial solved and Played come from the server.",
    headline: (t) => pct(onboarded(t)),
    sub: (t) =>
      `${n(t.onboarding_home ?? 0)} of ${n(t.onboarding_age ?? 0)} reached the home screen · ${n(t.played)} of ${n(t.created)} new profiles played a game`,
    cols: [
      { key: "welcome", label: "Welcome (sign-in screen)", value: (r) => r.onboarding_hello ?? 0 },
      { key: "age_step", label: "Age", value: (r) => r.onboarding_age ?? 0 },
      { key: "start_step", label: "How to start", value: (r) => r.onboarding_start ?? 0 },
      { key: "tutorial_step", label: "Tutorial", value: (r) => r.onboarding_tutorial ?? 0 },
      { key: "nickname_step", label: "Nickname", value: (r) => r.onboarding_nickname ?? 0 },
      { key: "reached_home", label: "Home", value: (r) => r.onboarding_home ?? 0 },
      { key: "completion_pct", label: "Finished %", value: onboarded },
      { key: "players_created", label: "New profiles", value: (r) => r.created },
      { key: "tutorial_cleared", label: "Tutorial solved", value: (r) => r.tutorial_cleared },
      { key: "played_a_game", label: "Played", value: (r) => r.played },
    ],
  },
  {
    id: "retention",
    group: "detail",
    title: "Coming back, by first-play day",
    note: "Players grouped by the GMT day of their first game (or first board-game move). Next day = how many played again the day after; a week later = on the 7th day after. A day shows no data until that later day is over. Test players left out.",
    headline: (t) => (d1(t) === null && d7(t) === null ? NO_DATA : `${pct(d1(t))} next day · ${pct(d7(t))} a week later`),
    sub: (t) =>
      `${n(t.ret_d1_kept ?? 0)} of ${n(t.ret_d1_cohort ?? 0)} came back the next day · ${n(t.ret_d7_kept ?? 0)} of ${n(t.ret_d7_cohort ?? 0)} a week later · ${n(t.ret_cohort ?? 0)} new players`,
    cols: [
      { key: "cohort", label: "New players", value: (r) => r.ret_cohort ?? 0 },
      { key: "d1_kept", label: "Back next day", value: (r) => ((r.ret_d1_cohort ?? 0) > 0 ? (r.ret_d1_kept ?? 0) : null) },
      { key: "d1_pct", label: "Next day %", value: d1 },
      { key: "d7_kept", label: "Back a week later", value: (r) => ((r.ret_d7_cohort ?? 0) > 0 ? (r.ret_d7_kept ?? 0) : null) },
      { key: "d7_pct", label: "Week later %", value: d7 },
    ],
  },
  {
    id: "game_over",
    group: "detail",
    title: "Board game results",
    note: "Finished board games (chess, draughts, Ludo, Oware and the others) as each player's end card showed them, once per game (counted on players' phones). With people = a friend or a live opponent; against the computer = the practice bot. Both players of a game with people send a result, so wins and losses roughly pair up.",
    headline: (t) => pct(rate(t.go_bot_won ?? 0, botGames(t))),
    sub: (t) =>
      `players' wins against the computer (${n(botGames(t))} games) · with people ${n(bayGames(t))} results: ${n(t.go_bay_won ?? 0)} won, ${n(t.go_bay_lost ?? 0)} lost, ${n(t.go_bay_draw ?? 0)} drawn`,
    cols: [
      { key: "people_won", label: "People: won", value: (r) => r.go_bay_won ?? 0 },
      { key: "people_lost", label: "People: lost", value: (r) => r.go_bay_lost ?? 0 },
      { key: "people_draw", label: "People: drawn", value: (r) => r.go_bay_draw ?? 0 },
      { key: "bot_won", label: "Computer: won", value: (r) => r.go_bot_won ?? 0 },
      { key: "bot_lost", label: "Computer: lost", value: (r) => r.go_bot_lost ?? 0 },
      { key: "bot_draw", label: "Computer: drawn", value: (r) => r.go_bot_draw ?? 0 },
      { key: "bot_win_pct", label: "Won vs computer %", value: (r) => rate(r.go_bot_won ?? 0, botGames(r)) },
    ],
  },
  {
    id: "practice",
    group: "detail",
    title: "Practice rounds by game",
    note: "The short first try of a game, with free hints (counted on players' phones). Finished = solved; skipped = Skip tapped; left early = started but neither. Games whose practice round is switched off in Game settings never show one.",
    headline: (t) => pct(rate(t.practice_finished ?? 0, t.practice_started ?? 0)),
    sub: (t) => {
      const c = practiceAll(t);
      return `finished of ${n(c.started)} started · ${n(c.skipped)} skipped (${pct(rate(c.skipped, c.started))}) · ${n(practiceDropped(c))} left early (${pct(rate(practiceDropped(c), c.started))})`;
    },
    cols: [
      { key: "started", label: "Started", value: (r) => r.practice_started ?? 0 },
      { key: "finished", label: "Finished", value: (r) => r.practice_finished ?? 0 },
      { key: "skipped", label: "Skipped", value: (r) => r.practice_skipped ?? 0 },
      { key: "dropped", label: "Left early", value: (r) => practiceDropped(practiceAll(r)) },
      { key: "finish_pct", label: "Finished %", value: (r) => rate(r.practice_finished ?? 0, r.practice_started ?? 0) },
    ],
    breakdown: {
      head: ["Game", "Started", "Finished", "Skipped", "Left early", "Finished %"],
      rows: (t) =>
        practiceGames(t).map(([g, c]) => ({
          key: g,
          label: GAME_BY_ID[g]?.name ?? g,
          values: [c.started, c.finished, c.skipped, practiceDropped(c), rate(c.finished, c.started)],
        })),
    },
    csv: practiceCsv,
  },
  {
    id: "hints",
    group: "detail",
    title: "Hints",
    note: "Finished solo puzzles where the player used a hint. Asked = Hint tapped; used = the hint was shown. Cancelled = asked but not used. Possibly by accident = hinted puzzles later given up, plus cancels, out of hinted puzzles plus cancels.",
    headline: (t) => pct(rate(t.hinted, t.attempts)),
    sub: (t) =>
      `of finished puzzles used a hint · ${n(t.hints_used)} hints · ${n(t.hint_requests ?? 0)} asked, ${n(t.hint_uses ?? 0)} used · possibly by accident ${pct(accidental(t))} (${n(hintCancels(t))} cancelled)`,
    cols: [
      { key: "finished_attempts", label: "Finished", value: (r) => r.attempts },
      { key: "attempts_with_hint", label: "With a hint", value: (r) => r.hinted },
      { key: "hints_used", label: "Hints", value: (r) => r.hints_used },
      { key: "hint_use_pct", label: "With a hint %", value: (r) => rate(r.hinted, r.attempts) },
      { key: "hinted_then_abandoned", label: "Hinted, given up", value: (r) => r.hinted_abandoned },
      { key: "hint_requests", label: "Asked", value: (r) => r.hint_requests ?? 0 },
      { key: "hint_went_ahead", label: "Used", value: (r) => r.hint_uses ?? 0 },
      { key: "confirm_cancels", label: "Cancelled", value: hintCancels },
      { key: "accidental_pct", label: "By accident %", value: accidental },
    ],
  },
  {
    id: "duels",
    group: "detail",
    title: "Duels: left early and computer stand-ins",
    note: "Duels created in these days. Left early = ended because a player left or lost connection, out of duels that started. Computer stand-in = a Quick Match that found no one and paired the player with the computer, out of Quick Match duels.",
    headline: (t) => pct(rate(t.duels_abandoned, t.duels_started)),
    sub: (t) => `left early, of ${n(t.duels_started)} started · computer stand-in ${pct(rate(t.duels_bot, t.duels_matchmade))}`,
    cols: [
      { key: "duels_started", label: "Started", value: (r) => r.duels_started },
      { key: "abandoned", label: "Left early", value: (r) => r.duels_abandoned },
      { key: "abandon_pct", label: "Left early %", value: (r) => rate(r.duels_abandoned, r.duels_started) },
      { key: "matchmade", label: "Quick Match", value: (r) => r.duels_matchmade },
      { key: "bot", label: "Computer", value: (r) => r.duels_bot },
      { key: "bot_fallback_pct", label: "Computer %", value: (r) => rate(r.duels_bot, r.duels_matchmade) },
    ],
  },
  {
    id: "duel_bands",
    group: "detail",
    title: "Duels by age group",
    note: "Duels created, by how (Challenge a friend or Quick Match) and the age group of the player who started it, recorded by the server. Under-16 Quick Match should always be 0: the server refuses it.",
    headline: (t) => n(createdDuels(t)),
    sub: (t) =>
      `${n(friendDuels(t))} with a friend · ${n(quickDuels(t))} Quick Match · under 16 ${pct(rate(under16Duels(t), createdDuels(t)))} (${n(under16Duels(t))})`,
    cols: [
      { key: "friend_13_15", label: "Friend 13-15", value: (r) => r.duels_friend_1315 ?? 0 },
      { key: "friend_16_17", label: "Friend 16-17", value: (r) => r.duels_friend_1617 ?? 0 },
      { key: "friend_18_plus", label: "Friend 18+", value: (r) => r.duels_friend_18 ?? 0 },
      { key: "quick_13_15", label: "Quick 13-15", value: (r) => r.duels_quick_1315 ?? 0 },
      { key: "quick_16_17", label: "Quick 16-17", value: (r) => r.duels_quick_1617 ?? 0 },
      { key: "quick_18_plus", label: "Quick 18+", value: (r) => r.duels_quick_18 ?? 0 },
      { key: "created", label: "Created", value: createdDuels },
      { key: "under_16_pct", label: "Under 16 %", value: (r) => rate(under16Duels(r), createdDuels(r)) },
    ],
  },
  {
    id: "daily",
    group: "detail",
    title: "Daily puzzles solved",
    note: "Daily puzzles started in these days that were solved (given up and flagged runs count as not solved). Test players left out.",
    headline: (t) => pct(rate(t.daily_cleared, t.daily_started)),
    sub: (t) => `${n(t.daily_cleared)} of ${n(t.daily_started)} Daily puzzles started`,
    cols: [
      { key: "started", label: "Started", value: (r) => r.daily_started },
      { key: "cleared", label: "Solved", value: (r) => r.daily_cleared },
      { key: "completion_pct", label: "Solved %", value: (r) => rate(r.daily_cleared, r.daily_started) },
    ],
  },
  {
    id: "shares",
    group: "detail",
    title: "Sharing",
    note: "Shares from the share sheet (counted on players' phones) for each finished game: solved puzzles plus finished Duels and Parties.",
    headline: (t) => pct(rate(t.shares, t.finished_games)),
    sub: (t) => `${n(t.shares)} shares · ${n(t.finished_games)} finished games`,
    cols: [
      { key: "shares", label: "Shares", value: (r) => r.shares },
      { key: "finished_games", label: "Finished games", value: (r) => r.finished_games },
      { key: "share_pct", label: "Share %", value: (r) => rate(r.shares, r.finished_games) },
    ],
  },
  {
    id: "prompts",
    group: "detail",
    title: "Pop-up prompts",
    note: "Prompts shown, accepted and closed (counted on players' phones), by what earned them. Notifications: accepted = Turn on. Low data: Turn on. Save your streak: the email was saved. Event banner: the quest was opened. Never more than one prompt on a screen.",
    headline: (t) => pct(accepted(t)),
    sub: (t) =>
      `accepted, of ${n(t.prompt_shown ?? 0)} shown · ${n(t.prompt_accepted ?? 0)} accepted, ${n(t.prompt_dismissed ?? 0)} closed`,
    cols: [
      { key: "shown", label: "Shown", value: (r) => r.prompt_shown ?? 0 },
      { key: "accepted", label: "Accepted", value: (r) => r.prompt_accepted ?? 0 },
      { key: "dismissed", label: "Closed", value: (r) => r.prompt_dismissed ?? 0 },
      { key: "accept_pct", label: "Accepted %", value: accepted },
    ],
    breakdown: {
      head: ["Prompt · what earned it", "Shown", "Accepted", "Closed", "Accepted %"],
      rows: (t) =>
        PROMPT_PAIRS.map(({ prompt, trigger }) => {
          const c = promptCounts(t, prompt, trigger);
          return {
            key: `${prompt}.${trigger}`,
            label: `${PROMPT_LABELS[prompt]} · ${TRIGGER_LABELS[trigger] ?? trigger}`,
            values: [c.shown, c.accepted, c.dismissed, rate(c.accepted, c.shown)],
          };
        }),
    },
    csv: promptsCsv,
  },
  {
    id: "daily_five",
    group: "detail",
    title: "Daily Five details",
    note: "Starts and completions = players beginning the day's five and playing all five; shares = result grids shared (counted on players' phones). Players and Full fives come from the server, each player once a day (test players left out).",
    headline: (t) => pct(rate(t.daily5_completes ?? 0, t.daily5_starts ?? 0)),
    sub: (t) =>
      `${n(t.daily5_completes ?? 0)} of ${n(t.daily5_starts ?? 0)} starts completed · ${n(t.daily5_shares ?? 0)} shares · ${n(t.daily5_players ?? 0)} players`,
    cols: [
      { key: "daily5_start", label: "Starts", value: (r) => r.daily5_starts ?? 0 },
      { key: "daily5_complete", label: "Completions", value: (r) => r.daily5_completes ?? 0 },
      { key: "daily5_share", label: "Shares", value: (r) => r.daily5_shares ?? 0 },
      { key: "completion_pct", label: "Completed %", value: (r) => rate(r.daily5_completes ?? 0, r.daily5_starts ?? 0) },
      { key: "share_pct", label: "Shared %", value: (r) => rate(r.daily5_shares ?? 0, r.daily5_completes ?? 0) },
      { key: "players", label: "Players", value: (r) => r.daily5_players ?? 0 },
      { key: "full_fives", label: "Full fives", value: (r) => r.daily5_full ?? 0 },
    ],
  },
  {
    id: "growth",
    group: "detail",
    title: "Party TV and streak shields",
    note: "TV views = times the big-screen Party view opened a room. Shields = guests who signed in from Save your streak and got the free Streak Freeze (once per player). Counted on players' phones, no names.",
    headline: (t) => n(t.gr_tv_views ?? 0),
    sub: (t) => `Party TV views · ${n(t.gr_shields ?? 0)} streak shields`,
    cols: [
      { key: "tv_views", label: "TV views", value: (r) => r.gr_tv_views ?? 0 },
      { key: "shields", label: "Streak shields", value: (r) => r.gr_shields ?? 0 },
    ],
  },
  {
    id: "streak_nudge",
    group: "detail",
    title: "Streak reminders",
    note: "Evening reminders to players whose streak would end at midnight (set in Game settings, Alerts), by the GMT day they went out. Sent = reached at least one phone. Solved within 3 h = of those, players who solved a puzzle within 3 hours. Test players left out.",
    headline: (t) => pct(rate(t.sn_cleared ?? 0, t.sn_sent ?? 0)),
    sub: (t) => `solved a puzzle within 3 h · ${n(t.sn_cleared ?? 0)} of ${n(t.sn_sent ?? 0)} reminders sent`,
    cols: [
      { key: "sent", label: "Sent", value: (r) => r.sn_sent ?? 0 },
      { key: "cleared_3h", label: "Solved within 3 h", value: (r) => r.sn_cleared ?? 0 },
      { key: "cleared_pct", label: "Solved %", value: (r) => rate(r.sn_cleared ?? 0, r.sn_sent ?? 0) },
    ],
  },
  {
    id: "weekly_recap",
    group: "detail",
    title: "Weekly recap card",
    note: "Last week's recap card on the home screen, at most once a week per phone (Feature switches, Weekly recap). Shown, shared, Play tapped and closed. Counted on players' phones, no names.",
    headline: (t) => pct(rate(t.wr_shared ?? 0, t.wr_shown ?? 0)),
    sub: (t) =>
      `shared, of ${n(t.wr_shown ?? 0)} shown · ${n(t.wr_shared ?? 0)} shares, ${n(t.wr_played ?? 0)} played, ${n(t.wr_dismissed ?? 0)} closed`,
    cols: [
      { key: "shown", label: "Shown", value: (r) => r.wr_shown ?? 0 },
      { key: "shared", label: "Shared", value: (r) => r.wr_shared ?? 0 },
      { key: "share_pct", label: "Shared %", value: (r) => rate(r.wr_shared ?? 0, r.wr_shown ?? 0) },
      { key: "played", label: "Played", value: (r) => r.wr_played ?? 0 },
      { key: "closed", label: "Closed", value: (r) => r.wr_dismissed ?? 0 },
    ],
  },
];

export const METRIC_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m])) as Record<MetricId, MetricDef>;

/** RFC 4180 cell: quoted when it holds a comma, quote or newline; formula-leading text is neutralised. */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV for one metric: header, one row per day, then a "total" row for the whole range. */
export function metricCsv(id: MetricId, data: Pick<MetricsData, "rows" | "total">): string {
  const def = METRIC_BY_ID[id];
  if (def.csv) return def.csv(data);
  const lines = [["date", ...def.cols.map((c) => c.key)].join(",")];
  for (const r of data.rows) lines.push([r.date ?? "", ...def.cols.map((c) => c.value(r))].map(csvCell).join(","));
  lines.push(["total", ...def.cols.map((c) => c.value(data.total))].map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}
