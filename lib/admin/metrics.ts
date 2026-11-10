/**
 * Admin Metrics page (admin cascade): metric definitions, rates, percentiles and CSV. Pure and free of server
 * imports, so the /admin UI, the API route and the tests share one definition of every number.
 *
 * The database aggregates (public.svc_admin_metrics): one row per GMT day plus a range total. Percentiles there
 * are percentile_cont; `percentile` below is the same linear interpolation for code and tests.
 */
import { addDays, ISO_DATE, todayIso } from "./dates";
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

type Col = { key: string; label: string; value: (r: MetricRow) => number | null };
export interface MetricDef {
  id: MetricId;
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

const ms = (v: number | null) => (v === null ? "n/a" : v >= 10_000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
const pct = (v: number | null) => (v === null ? "n/a" : `${v}%`);
/** A long wait in words: seconds, minutes, hours, then days (landing to first clear). */
export const span = (v: number | null) => {
  if (v === null) return "n/a";
  const s = v / 1000;
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 48 * 3600) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86_400).toFixed(1)} d`;
};
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
    title: "Tap to board",
    note: "Time from the tap that opened a Play screen to its board being interactive (client measured). Cold load is from page navigation start.",
    headline: (t) => `${ms(t.tap_p50)} / ${ms(t.tap_p95)}`,
    sub: (t) => `p50 / p95 · ${n(t.tap_n)} taps · cold load p50 ${ms(t.load_p50)}`,
    cols: [
      { key: "tap_count", label: "Taps", value: (r) => r.tap_n },
      { key: "tap_p50_ms", label: "Tap p50 ms", value: (r) => r.tap_p50 },
      { key: "tap_p95_ms", label: "Tap p95 ms", value: (r) => r.tap_p95 },
      { key: "load_count", label: "Cold loads", value: (r) => r.load_n },
      { key: "load_p50_ms", label: "Load p50 ms", value: (r) => r.load_p50 },
      { key: "load_p95_ms", label: "Load p95 ms", value: (r) => r.load_p95 },
    ],
  },
  {
    id: "tap_warmth",
    title: "Tap to board, cold and warm",
    note: "Cold = the first board of the page session: the page opened straight on Play, or the first game tapped after it loaded (its code and data not loaded yet). Warm = every later board in the same page. Client measured (tap_to_board with warm); taps from older clients are only in Tap to board.",
    headline: (t) => `${ms(t.cold_p50 ?? null)} / ${ms(t.warm_p50 ?? null)}`,
    sub: (t) =>
      `cold p50 / warm p50 · cold p95 ${ms(t.cold_p95 ?? null)} (${n(t.cold_n ?? 0)}) · warm p95 ${ms(t.warm_p95 ?? null)} (${n(t.warm_n ?? 0)})`,
    cols: [
      { key: "cold_count", label: "Cold", value: (r) => r.cold_n ?? 0 },
      { key: "cold_p50_ms", label: "Cold p50 ms", value: (r) => r.cold_p50 ?? null },
      { key: "cold_p95_ms", label: "Cold p95 ms", value: (r) => r.cold_p95 ?? null },
      { key: "warm_count", label: "Warm", value: (r) => r.warm_n ?? 0 },
      { key: "warm_p50_ms", label: "Warm p50 ms", value: (r) => r.warm_p50 ?? null },
      { key: "warm_p95_ms", label: "Warm p95 ms", value: (r) => r.warm_p95 ?? null },
    ],
  },
  {
    id: "first_clear",
    title: "Landing to first clear",
    note: "Players whose profile was made that day (the landing: Welcome makes a guest profile on the first visit), how many have cleared a board since (any mode but the onboarding tutorial), and the time from landing to that first clear. Server recorded (players and attempts), test players left out. Recent days keep growing as players come back.",
    headline: (t) => `${span(t.fc_p50 ?? null)} / ${span(t.fc_p95 ?? null)}`,
    sub: (t) =>
      `p50 / p95 · ${n(t.fc_cleared ?? 0)} of ${n(t.fc_cohort ?? 0)} new players cleared one (${pct(rate(t.fc_cleared ?? 0, t.fc_cohort ?? 0))})`,
    cols: [
      { key: "new_players", label: "New players", value: (r) => r.fc_cohort ?? 0 },
      { key: "cleared", label: "Cleared one", value: (r) => r.fc_cleared ?? 0 },
      { key: "cleared_pct", label: "Cleared %", value: (r) => rate(r.fc_cleared ?? 0, r.fc_cohort ?? 0) },
      { key: "p50_ms", label: "p50 ms", value: (r) => r.fc_p50 ?? null },
      { key: "p95_ms", label: "p95 ms", value: (r) => r.fc_p95 ?? null },
    ],
  },
  {
    id: "onboarding",
    title: "Onboarding completion",
    note: "Of new players who reached the age step of Welcome, the share that reached Home (first-party onboarding_step, client recorded). Step columns count each Welcome step once per visit; Created, Tutorial cleared and Played come from profiles and attempts.",
    headline: (t) => pct(onboarded(t)),
    sub: (t) =>
      `${n(t.onboarding_home ?? 0)} of ${n(t.onboarding_age ?? 0)} reached Home · ${n(t.played)} of ${n(t.created)} new profiles played`,
    cols: [
      { key: "welcome", label: "Welcome", value: (r) => r.onboarding_hello ?? 0 },
      { key: "age_step", label: "Age", value: (r) => r.onboarding_age ?? 0 },
      { key: "start_step", label: "How to start", value: (r) => r.onboarding_start ?? 0 },
      { key: "tutorial_step", label: "Tutorial", value: (r) => r.onboarding_tutorial ?? 0 },
      { key: "nickname_step", label: "Nickname", value: (r) => r.onboarding_nickname ?? 0 },
      { key: "reached_home", label: "Home", value: (r) => r.onboarding_home ?? 0 },
      { key: "completion_pct", label: "Completion %", value: onboarded },
      { key: "players_created", label: "Created", value: (r) => r.created },
      { key: "tutorial_cleared", label: "Tutorial cleared", value: (r) => r.tutorial_cleared },
      { key: "played_a_game", label: "Played", value: (r) => r.played },
    ],
  },
  {
    id: "retention",
    title: "D1 and D7 retention",
    note: "Cohort = players whose first game started (or first Board Bay move was made) that GMT day (test players left out). D1 = of them, the share who started a game or made a Board Bay move the next day; D7 = 7 days later. A day shows n/a until that later day is over. Same rule as Live ops, by day.",
    headline: (t) => `${pct(d1(t))} / ${pct(d7(t))}`,
    sub: (t) =>
      `D1 / D7 · D1 ${n(t.ret_d1_kept ?? 0)} of ${n(t.ret_d1_cohort ?? 0)} · D7 ${n(t.ret_d7_kept ?? 0)} of ${n(t.ret_d7_cohort ?? 0)} · ${n(t.ret_cohort ?? 0)} new players`,
    cols: [
      { key: "cohort", label: "Cohort", value: (r) => r.ret_cohort ?? 0 },
      { key: "d1_kept", label: "Back D1", value: (r) => ((r.ret_d1_cohort ?? 0) > 0 ? (r.ret_d1_kept ?? 0) : null) },
      { key: "d1_pct", label: "D1 %", value: d1 },
      { key: "d7_kept", label: "Back D7", value: (r) => ((r.ret_d7_cohort ?? 0) > 0 ? (r.ret_d7_kept ?? 0) : null) },
      { key: "d7_pct", label: "D7 %", value: d7 },
    ],
  },
  {
    id: "game_over",
    title: "Board game results",
    note: "Full games (chess, draughts, Ludo, Oware and the other Board Games) as each player's game-over card showed them, once per game per browser tab (client recorded, game_over). With people = a friend or Play live; vs bot = the Practice bot or a bot seat. Every player of a game with people sends their own result, so its wins and losses roughly pair up.",
    headline: (t) => pct(rate(t.go_bot_won ?? 0, botGames(t))),
    sub: (t) =>
      `players' win rate vs the bot (${n(botGames(t))} games) · with people ${n(bayGames(t))} results: ${n(t.go_bay_won ?? 0)} won, ${n(t.go_bay_lost ?? 0)} lost, ${n(t.go_bay_draw ?? 0)} drawn`,
    cols: [
      { key: "people_won", label: "People: won", value: (r) => r.go_bay_won ?? 0 },
      { key: "people_lost", label: "People: lost", value: (r) => r.go_bay_lost ?? 0 },
      { key: "people_draw", label: "People: draw", value: (r) => r.go_bay_draw ?? 0 },
      { key: "bot_won", label: "Bot: won", value: (r) => r.go_bot_won ?? 0 },
      { key: "bot_lost", label: "Bot: lost", value: (r) => r.go_bot_lost ?? 0 },
      { key: "bot_draw", label: "Bot: draw", value: (r) => r.go_bot_draw ?? 0 },
      { key: "bot_win_pct", label: "Bot win %", value: (r) => rate(r.go_bot_won ?? 0, botGames(r)) },
    ],
  },
  {
    id: "practice",
    title: "Practice rounds",
    note: "The short first try of a game with free hints (client recorded). Started = the practice board showed; finished = solved; skipped = Skip tapped; dropped = started but neither (the player left). Games whose practice round is off in Settings never start one.",
    headline: (t) => pct(rate(t.practice_finished ?? 0, t.practice_started ?? 0)),
    sub: (t) => {
      const c = practiceAll(t);
      return `finished of ${n(c.started)} started · ${n(c.skipped)} skipped (${pct(rate(c.skipped, c.started))}) · ${n(practiceDropped(c))} dropped (${pct(rate(practiceDropped(c), c.started))})`;
    },
    cols: [
      { key: "started", label: "Started", value: (r) => r.practice_started ?? 0 },
      { key: "finished", label: "Finished", value: (r) => r.practice_finished ?? 0 },
      { key: "skipped", label: "Skipped", value: (r) => r.practice_skipped ?? 0 },
      { key: "dropped", label: "Dropped", value: (r) => practiceDropped(practiceAll(r)) },
      { key: "finish_pct", label: "Finish %", value: (r) => rate(r.practice_finished ?? 0, r.practice_started ?? 0) },
    ],
    breakdown: {
      head: ["Game", "Started", "Finished", "Skipped", "Dropped", "Finish %"],
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
    id: "first_move",
    title: "Time to first move",
    note: "first_move_at minus started_at on solo attempts (Daily, free, archive, challenge) started in the range.",
    headline: (t) => `${ms(t.first_move_p50)} / ${ms(t.first_move_p95)}`,
    sub: (t) => `p50 / p95 · ${n(t.first_move_n)} attempts`,
    cols: [
      { key: "attempts", label: "Attempts", value: (r) => r.first_move_n },
      { key: "p50_ms", label: "p50 ms", value: (r) => r.first_move_p50 },
      { key: "p95_ms", label: "p95 ms", value: (r) => r.first_move_p95 },
    ],
  },
  {
    id: "party_first_move",
    title: "Party start to first move",
    note: "Time from a Party game's real start (the end of its 3-2-1-SPUZL! countdown) to each racer's first move on the board, on the server clock (client recorded, party_first_move). One per racer per game; a reload into a game already started is not counted again.",
    headline: (t) => `${ms(t.party_first_move_p50 ?? null)} / ${ms(t.party_first_move_p95 ?? null)}`,
    sub: (t) => `p50 / p95 · ${n(t.party_first_move_n ?? 0)} first moves`,
    cols: [
      { key: "first_moves", label: "First moves", value: (r) => r.party_first_move_n ?? 0 },
      { key: "p50_ms", label: "p50 ms", value: (r) => r.party_first_move_p50 ?? null },
      { key: "p95_ms", label: "p95 ms", value: (r) => r.party_first_move_p95 ?? null },
    ],
  },
  {
    id: "hints",
    title: "Hint use",
    note: "Finished solo attempts that used a hint. Requested = taps on Hint; went ahead = hints the player confirmed or that needed no confirm (client recorded). Cancelled = requested minus went ahead. Accidental = hinted attempts later abandoned plus cancels, over hinted attempts plus cancels.",
    headline: (t) => pct(rate(t.hinted, t.attempts)),
    sub: (t) =>
      `${n(t.hints_used)} hints · ${n(t.hint_requests ?? 0)} requested, ${n(t.hint_uses ?? 0)} went ahead · accidental ${pct(accidental(t))} (${n(hintCancels(t))} cancels)`,
    cols: [
      { key: "finished_attempts", label: "Finished", value: (r) => r.attempts },
      { key: "attempts_with_hint", label: "With hint", value: (r) => r.hinted },
      { key: "hints_used", label: "Hints", value: (r) => r.hints_used },
      { key: "hint_use_pct", label: "Use %", value: (r) => rate(r.hinted, r.attempts) },
      { key: "hinted_then_abandoned", label: "Hinted, abandoned", value: (r) => r.hinted_abandoned },
      { key: "hint_requests", label: "Requested", value: (r) => r.hint_requests ?? 0 },
      { key: "hint_went_ahead", label: "Went ahead", value: (r) => r.hint_uses ?? 0 },
      { key: "confirm_cancels", label: "Cancelled", value: hintCancels },
      { key: "accidental_pct", label: "Accidental %", value: accidental },
    ],
  },
  {
    id: "duels",
    title: "Duels",
    note: "Duels created in the range. Abandon = ended because a player left or dropped, over duels that started. Bot fallback = bot matches over matchmade duels (no lobby code).",
    headline: (t) => pct(rate(t.duels_abandoned, t.duels_started)),
    sub: (t) => `abandoned of ${n(t.duels_started)} started · bot fallback ${pct(rate(t.duels_bot, t.duels_matchmade))}`,
    cols: [
      { key: "duels_started", label: "Started", value: (r) => r.duels_started },
      { key: "abandoned", label: "Abandoned", value: (r) => r.duels_abandoned },
      { key: "abandon_pct", label: "Abandon %", value: (r) => rate(r.duels_abandoned, r.duels_started) },
      { key: "matchmade", label: "Matchmade", value: (r) => r.duels_matchmade },
      { key: "bot", label: "Bot", value: (r) => r.duels_bot },
      { key: "bot_fallback_pct", label: "Bot %", value: (r) => rate(r.duels_bot, r.duels_matchmade) },
    ],
  },
  {
    id: "duel_bands",
    title: "Duels created by age band",
    note: "Duels created in the range, by how (Challenge a friend or a Quick Match pairing) and the creator's age band, recorded by the server (duel_created). Under-16 Quick Match should always be 0: the server refuses it.",
    headline: (t) => n(createdDuels(t)),
    sub: (t) =>
      `${n(friendDuels(t))} friend · ${n(quickDuels(t))} Quick Match · under 16 ${pct(rate(under16Duels(t), createdDuels(t)))} (${n(under16Duels(t))})`,
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
    title: "Daily completion",
    note: "Daily attempts started in the range that were cleared (flagged and abandoned runs count as not cleared).",
    headline: (t) => pct(rate(t.daily_cleared, t.daily_started)),
    sub: (t) => `${n(t.daily_cleared)} of ${n(t.daily_started)} Dailies started`,
    cols: [
      { key: "started", label: "Started", value: (r) => r.daily_started },
      { key: "cleared", label: "Cleared", value: (r) => r.daily_cleared },
      { key: "completion_pct", label: "Completion %", value: (r) => rate(r.daily_cleared, r.daily_started) },
    ],
  },
  {
    id: "shares",
    title: "Share rate",
    note: "Shares from the share sheet (client recorded) per finished game: cleared solo attempts plus finished matches.",
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
    title: "Prompt acceptance by trigger",
    note: "Prompts shown, accepted and dismissed (client recorded), by the trigger that earned them. Notifications: accepted = Turn on pressed. Low data: Turn on. Save your streak: the email was saved. Event banner: the quest link. Never more than one prompt per screen.",
    headline: (t) => pct(accepted(t)),
    sub: (t) =>
      `accepted of ${n(t.prompt_shown ?? 0)} shown · ${n(t.prompt_accepted ?? 0)} accepted, ${n(t.prompt_dismissed ?? 0)} dismissed`,
    cols: [
      { key: "shown", label: "Shown", value: (r) => r.prompt_shown ?? 0 },
      { key: "accepted", label: "Accepted", value: (r) => r.prompt_accepted ?? 0 },
      { key: "dismissed", label: "Dismissed", value: (r) => r.prompt_dismissed ?? 0 },
      { key: "accept_pct", label: "Accept %", value: accepted },
    ],
    breakdown: {
      head: ["Prompt · trigger", "Shown", "Accepted", "Dismissed", "Accept %"],
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
    title: "Daily Five",
    note: "Starts = players who began the day's five (daily5_start), completions = players who played all five (daily5_complete), shares = share grids sent or copied (daily5_share); client recorded. Players and Full fives come from Daily Five attempts on the server (test players left out).",
    headline: (t) => pct(rate(t.daily5_completes ?? 0, t.daily5_starts ?? 0)),
    sub: (t) =>
      `${n(t.daily5_completes ?? 0)} of ${n(t.daily5_starts ?? 0)} starts completed · ${n(t.daily5_shares ?? 0)} shares · ${n(t.daily5_players ?? 0)} players`,
    cols: [
      { key: "daily5_start", label: "Starts", value: (r) => r.daily5_starts ?? 0 },
      { key: "daily5_complete", label: "Completions", value: (r) => r.daily5_completes ?? 0 },
      { key: "daily5_share", label: "Shares", value: (r) => r.daily5_shares ?? 0 },
      { key: "completion_pct", label: "Completion %", value: (r) => rate(r.daily5_completes ?? 0, r.daily5_starts ?? 0) },
      { key: "share_pct", label: "Share %", value: (r) => rate(r.daily5_shares ?? 0, r.daily5_completes ?? 0) },
      { key: "players", label: "Players", value: (r) => r.daily5_players ?? 0 },
      { key: "full_fives", label: "Full fives", value: (r) => r.daily5_full ?? 0 },
    ],
  },
  {
    id: "growth",
    title: "Party TV and streak shields",
    note: "TV views = times the big-screen Party view loaded a room (party_tv_view). Shields = guests who signed in from Save your streak and got the free Streak Freeze (streak_shield, once per player). Client recorded, anonymous.",
    headline: (t) => n(t.gr_tv_views ?? 0),
    sub: (t) => `Party TV views · ${n(t.gr_shields ?? 0)} streak shields`,
    cols: [
      { key: "tv_views", label: "TV views", value: (r) => r.gr_tv_views ?? 0 },
      { key: "shields", label: "Streak shields", value: (r) => r.gr_shields ?? 0 },
    ],
  },
  {
    id: "streak_nudge",
    title: "Streak-at-risk nudges",
    note: "Evening pushes to players whose streak would end at midnight (admin Alerts settings), by the GMT day they went out. Sent = delivered to at least one device. Cleared in 3 h = of those, players who cleared a board within 3 hours of the push. Server recorded; test players left out.",
    headline: (t) => pct(rate(t.sn_cleared ?? 0, t.sn_sent ?? 0)),
    sub: (t) => `cleared within 3 h · ${n(t.sn_cleared ?? 0)} of ${n(t.sn_sent ?? 0)} nudges sent`,
    cols: [
      { key: "sent", label: "Sent", value: (r) => r.sn_sent ?? 0 },
      { key: "cleared_3h", label: "Cleared in 3 h", value: (r) => r.sn_cleared ?? 0 },
      { key: "cleared_pct", label: "Cleared %", value: (r) => rate(r.sn_cleared ?? 0, r.sn_sent ?? 0) },
    ],
  },
  {
    id: "weekly_recap",
    title: "Weekly recap",
    note: "Last week's recap card on Home, at most once a week per device (admin Features > Weekly recap). Shown = the card appeared (prompt_shown), Shared = shared or saved from its share sheet (share, kind recap), Played = Play today's Daily tapped, Closed = dismissed. Client recorded, anonymous.",
    headline: (t) => pct(rate(t.wr_shared ?? 0, t.wr_shown ?? 0)),
    sub: (t) =>
      `shared of ${n(t.wr_shown ?? 0)} shown · ${n(t.wr_shared ?? 0)} shares, ${n(t.wr_played ?? 0)} played, ${n(t.wr_dismissed ?? 0)} closed`,
    cols: [
      { key: "shown", label: "Shown", value: (r) => r.wr_shown ?? 0 },
      { key: "shared", label: "Shared", value: (r) => r.wr_shared ?? 0 },
      { key: "share_pct", label: "Share %", value: (r) => rate(r.wr_shared ?? 0, r.wr_shown ?? 0) },
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
