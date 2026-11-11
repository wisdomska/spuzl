import { describe, expect, it } from "vitest";
import {
  change,
  changeTone,
  count,
  dailyAverage,
  duration,
  extremes,
  guests,
  INSIGHT_BY_ID,
  INSIGHT_IDS,
  INSIGHT_SECTIONS,
  INSIGHTS,
  insightCsv,
  isInsightId,
  nextDay,
  percent,
  plays,
  practiceLeft,
  previousRange,
  sparkline,
  topGames,
  weekLater,
  worldPlays,
} from "./insights";
import { METRIC_IDS, type MetricRow } from "./metrics";
import { adminCopy } from "@/lib/copy/admin";

/** A row as an older API (before 20261211020101) would send it: none of the owner fields. */
const row = (over: Partial<MetricRow> = {}): MetricRow =>
  ({
    created: 0,
    played: 0,
    daily_started: 0,
    daily_cleared: 0,
    ...over,
  }) as MetricRow;

describe("previous period", () => {
  it("is the same number of days straight before", () => {
    expect(previousRange("2026-11-04", 7)).toEqual({ from: "2026-10-28", to: "2026-11-03" });
    expect(previousRange("2026-10-12", 30)).toEqual({ from: "2026-09-12", to: "2026-10-11" });
    expect(previousRange("2026-03-01", 1)).toEqual({ from: "2026-02-28", to: "2026-02-28" });
  });
  it("refuses a bad range", () => {
    expect(() => previousRange("2026-3-1", 7)).toThrow("bad_range");
    expect(() => previousRange("2026-03-01", 0)).toThrow("bad_range");
  });
});

describe("comparisons", () => {
  it("counts: whole percent change, rounded", () => {
    expect(change(120, 100, "count")).toEqual({ dir: "up", amount: 20, unit: "percent" });
    expect(change(2, 3, "count")).toEqual({ dir: "down", amount: 33, unit: "percent" });
    expect(change(1001, 1000, "count")).toEqual({ dir: "same", amount: 0, unit: "percent" });
  });
  it("counts: nothing before is never a division by zero", () => {
    expect(change(0, 0, "count")).toEqual({ dir: "same", amount: 0, unit: "percent" });
    expect(change(5, 0, "count")).toEqual({ dir: "up", amount: null, unit: "percent" });
  });
  it("percentages: whole points", () => {
    expect(change(45.4, 40, "percent")).toEqual({ dir: "up", amount: 5, unit: "points" });
    expect(change(30, 31.2, "percent")).toEqual({ dir: "down", amount: 1, unit: "points" });
    expect(change(30, 30.4, "percent")).toEqual({ dir: "same", amount: 0, unit: "points" });
  });
  it("no comparison when either side has nothing to measure", () => {
    expect(change(null, 10, "percent")).toBeNull();
    expect(change(10, null, "percent")).toBeNull();
    expect(change(10, undefined, "count")).toBeNull();
  });
  it("colours good and bad news, never for neutral numbers", () => {
    expect(changeTone(change(12, 10, "count"), "up")).toBe("good");
    expect(changeTone(change(8, 10, "count"), "up")).toBe("bad");
    expect(changeTone(change(20, 10, "count"), "neutral")).toBe("neutral");
    expect(changeTone(null, "up")).toBe("neutral");
  });
});

describe("formats", () => {
  it("counts with separators", () => {
    expect(count(1234567)).toBe("1,234,567");
    expect(count(12.6)).toBe("13");
    expect(count(0)).toBe("0");
  });
  it("percentages rounded, tiny shares not shown as 0", () => {
    expect(percent(null)).toBeNull();
    expect(percent(0)).toBe("0%");
    expect(percent(0.3)).toBe("under 1%");
    expect(percent(45.5)).toBe("46%");
    expect(percent(100)).toBe("100%");
  });
  it("durations in words", () => {
    expect(duration(null)).toBeNull();
    expect(duration(undefined)).toBeNull();
    expect(duration(-5)).toBeNull();
    expect(duration(0)).toBe("0.0 s");
    expect(duration(420)).toBe("0.4 s");
    expect(duration(9_960)).toBe("10.0 s");
    expect(duration(12_400)).toBe("12 s");
    expect(duration(59_600)).toBe("1 min");
    expect(duration(80_000)).toBe("1 min 20 s");
    expect(duration(3_600_000)).toBe("1 h");
    expect(duration(7_500_000)).toBe("2 h 5 min");
    expect(duration(3 * 86_400_000)).toBe("3 days");
  });
});

describe("daily average and extremes", () => {
  it("averages only the days with a value", () => {
    expect(dailyAverage([row({ active: 4 }), row({ active: 6 })], (r) => r.active ?? 0)).toBe(5);
    expect(dailyAverage([row(), row({ rt_d1_cohort: 2, rt_d1_kept: 1 })], nextDay)).toBe(50);
  });
  it("an empty range has no average (no division by zero)", () => {
    expect(dailyAverage([], (r) => r.active ?? 0)).toBeNull();
    expect(dailyAverage([row(), row()], nextDay)).toBeNull();
  });
  it("finds the busiest and quietest day, first one on a tie", () => {
    const rows = [row({ date: "2026-11-01", active: 3 }), row({ date: "2026-11-02", active: 9 }), row({ date: "2026-11-03", active: 3 })];
    expect(extremes(rows, (r) => r.active ?? 0)).toEqual({ hi: { date: "2026-11-02", v: 9 }, lo: { date: "2026-11-01", v: 3 } });
    expect(extremes([], (r) => r.active ?? 0)).toEqual({ hi: null, lo: null });
  });
});

describe("trend line", () => {
  it("draws nothing when no day has a value", () => {
    expect(sparkline([])).toEqual([]);
    expect(sparkline([null, null])).toEqual([]);
  });
  it("one day is a single point in the middle", () => {
    expect(sparkline([5])).toEqual(["50,1"]);
  });
  it("starts at zero and breaks the line at days without a value", () => {
    expect(sparkline([0, 10, null, 5, 10], 28)).toEqual(["0,27 25,1", "75,14 100,1"]);
  });
  it("a flat zero line sits on the floor", () => {
    expect(sparkline([0, 0])).toEqual(["0,27 100,27"]);
  });
});

describe("owner numbers", () => {
  it("rows from an older API read as zero or no data, never as an error", () => {
    const r = row();
    for (const d of INSIGHTS) expect(() => d.value(r)).not.toThrow();
    expect(INSIGHT_BY_ID.players.value(r)).toBe(0);
    expect(INSIGHT_BY_ID.next_day.value(r)).toBeNull();
    expect(INSIGHT_BY_ID.saved_accounts.value(r)).toBeNull();
    expect(INSIGHT_BY_ID.first_game.value(r)).toBeNull();
  });
  it("guests and players who left practice early are never negative", () => {
    expect(guests(row({ active: 3, active_saved: 5 }))).toBe(0);
    expect(guests(row({ active: 10, active_saved: 4 }))).toBe(6);
    expect(practiceLeft(row({ practice_started: 3, practice_finished: 2, practice_skipped: 2 }))).toBe(0);
  });
  it("games played adds puzzles and board-game plays", () => {
    expect(plays(row({ puzzles_started: 7, board_plays: 3 }))).toBe(10);
  });
  it("returns rate kept over first-time players", () => {
    expect(nextDay(row({ rt_d1_cohort: 8, rt_d1_kept: 3 }))).toBe(37.5);
    expect(weekLater(row({ rt_d7_cohort: 3, rt_d7_kept: 1 }))).toBe(33.3);
  });
  it("ids never clash with the older cards (one CSV route serves both)", () => {
    for (const id of INSIGHT_IDS) expect((METRIC_IDS as readonly string[]).includes(id)).toBe(false);
    expect(isInsightId("players")).toBe(true);
    expect(isInsightId("hints")).toBe(false);
  });
  it("every card has copy and a section, and every section has cards", () => {
    for (const d of INSIGHTS) {
      const c = adminCopy.metrics.cards[d.id];
      expect(c.label.length).toBeGreaterThan(2);
      expect(c.meaning.length).toBeGreaterThan(10);
      expect(c.definition.length).toBeGreaterThan(20);
    }
    for (const s of INSIGHT_SECTIONS) expect(INSIGHTS.some((d) => d.section === s)).toBe(true);
    expect(new Set(INSIGHTS.map((d) => d.id)).size).toBe(INSIGHTS.length);
  });
  it("the main copy avoids technical words", () => {
    const text = JSON.stringify(Object.values(adminCopy.metrics.cards).map((c) => [c.label, c.meaning])).toLowerCase();
    for (const w of ["p50", "p95", " ms", "cohort", "dau", "retention", "svc_", "client recorded", "d1", "d7"])
      expect(text).not.toContain(w);
  });
});

describe("busiest games and worlds", () => {
  const t = row({
    top_games: {
      dusk: { plays: 10, players: 4 },
      chess: { plays: 10, players: 2 },
      isles: { plays: 5, players: 5 },
      hunch: { plays: 3, players: 1 },
      gone: { plays: 2, players: 2 },
    },
  });
  it("sorts by plays, then name, with the previous period's plays", () => {
    const g = topGames(t, row({ top_games: { dusk: { plays: 8, players: 3 } } }));
    expect(g.map((x) => x.id)).toEqual(["chess", "dusk", "isles", "hunch", "gone"]);
    expect(g[1]).toMatchObject({ name: "Dusk", world: "logic", plays: 10, players: 4, prevPlays: 8 });
    expect(g[0].prevPlays).toBe(0);
    expect(g[4]).toMatchObject({ name: "gone", world: null });
  });
  it("adds up worlds, folding retired worlds into the one that took their games", () => {
    expect(worldPlays(t)).toEqual([
      { id: "logic", name: "Puzzles", plays: 15, share: 50 },
      { id: "board", name: "Board Games", plays: 10, share: 33.3 },
      { id: "word", name: "Words & Quiz", plays: 3, share: 10 },
      { id: "other", name: null, plays: 2, share: 6.7 },
    ]);
  });
  it("an empty range has no games and no worlds", () => {
    expect(topGames(row())).toEqual([]);
    expect(worldPlays(row({ top_games: {} }))).toEqual([]);
  });
});

describe("CSV", () => {
  it("one row per day, then the range total", () => {
    const rows = [row({ date: "2026-11-01", active: 3, active_saved: 1 }), row({ date: "2026-11-02", active: 2, active_saved: 2 })];
    expect(insightCsv("players", { rows, total: row({ active: 4, active_saved: 2 }) }).split("\r\n")).toEqual([
      "date,players,saved_account,guests",
      "2026-11-01,3,1,2",
      "2026-11-02,2,2,0",
      "total,4,2,2",
      "",
    ]);
  });
  it("a count of right now has one row", () => {
    expect(insightCsv("streaks", { rows: [row({ date: "2026-11-01" })], total: row({ streak_3: 9, streak_7: 2 }) })).toBe(
      "date,streak_3_plus_now,streak_7_plus_now\r\nnow,9,2\r\n",
    );
  });
  it("percentages with nothing to measure are empty cells", () => {
    expect(insightCsv("next_day", { rows: [], total: row() })).toBe(
      "date,first_played_day_before,came_back,came_back_pct\r\ntotal,0,0,\r\n",
    );
  });
  it("busiest games: one row per game", () => {
    expect(insightCsv("top_games", { rows: [], total: row({ top_games: { dusk: { plays: 2, players: 1 } } }) })).toBe(
      "game,world,plays,players\r\ndusk,logic,2,1\r\n",
    );
  });
});
