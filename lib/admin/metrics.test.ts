import { describe, expect, it } from "vitest";
import { csvCell, METRIC_IDS, metricCsv, metricRange, percentile, rate, type MetricRow } from "./metrics";

const row = (over: Partial<MetricRow> = {}): MetricRow => ({
  tap_n: 0,
  tap_p50: null,
  tap_p95: null,
  load_n: 0,
  load_p50: null,
  load_p95: null,
  created: 0,
  tutorial_started: 0,
  tutorial_cleared: 0,
  played: 0,
  first_move_n: 0,
  first_move_p50: null,
  first_move_p95: null,
  attempts: 0,
  hinted: 0,
  hints_used: 0,
  hinted_abandoned: 0,
  hint_cancels: 0,
  duels_started: 0,
  duels_abandoned: 0,
  duels_matchmade: 0,
  duels_bot: 0,
  daily_started: 0,
  daily_cleared: 0,
  shares: 0,
  finished_games: 0,
  ...over,
});

describe("metrics percentiles", () => {
  it("interpolates like Postgres percentile_cont", () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([7], 0.95)).toBe(7);
    expect(percentile([400, 100, 300, 200], 0.5)).toBe(250);
    expect(percentile([100, 200, 300, 400], 0.95)).toBeCloseTo(385);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0.5)).toBe(6);
    expect(percentile([1, 2, Number.NaN, 3], 1)).toBe(3);
    expect(percentile([5, 1], -1)).toBe(1);
  });

  it("rounds rates to one decimal and refuses a zero denominator", () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(2, 3)).toBe(66.7);
    expect(rate(0, 5)).toBe(0);
    expect(rate(3, 0)).toBeNull();
  });

  it("covers the days ending on the chosen date", () => {
    expect(metricRange(7, "2026-11-01")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(metricRange(30, "2026-03-01")).toEqual({ from: "2026-01-31", to: "2026-03-01" });
    expect(() => metricRange(7, "nope")).toThrow();
  });
});

describe("metrics CSV", () => {
  it("quotes cells and neutralises formulas", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
  });

  it("writes a header, one row per day and a total for every metric", () => {
    const data = {
      rows: [row({ date: "2026-10-31", daily_started: 4, daily_cleared: 3 }), row({ date: "2026-11-01", daily_started: 0 })],
      total: row({ daily_started: 4, daily_cleared: 3, hinted: 2, hint_cancels: 2, hinted_abandoned: 1, attempts: 8 }),
    };
    const daily = metricCsv("daily", data).trimEnd().split("\r\n");
    expect(daily).toEqual(["date,started,cleared,completion_pct", "2026-10-31,4,3,75", "2026-11-01,0,0,", "total,4,3,75"]);
    const hints = metricCsv("hints", data).split("\r\n");
    expect(hints[0]).toBe(
      "date,finished_attempts,attempts_with_hint,hints_used,hint_use_pct,hinted_then_abandoned,confirm_cancels,accidental_pct",
    );
    // accidental = (1 abandoned + 2 cancels) / (2 hinted + 2 cancels)
    expect(hints[3]).toBe("total,8,2,0,25,1,2,75");
    for (const id of METRIC_IDS) expect(metricCsv(id, data).startsWith("date,")).toBe(true);
  });
});
