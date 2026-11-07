import { describe, expect, it } from "vitest";
import { d1, d7, METRIC_BY_ID, METRIC_IDS, metricCsv, practiceDropped, span, type MetricRow } from "./metrics";

/** R2-ADMIN: the Metrics cards added by the admin cascade audit (docs/qa/ADMIN_CASCADE_R2.md). */
const row = (over: Partial<MetricRow> = {}): MetricRow =>
  ({
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
    onboarding_hello: 0,
    onboarding_signin: 0,
    onboarding_age: 0,
    onboarding_too_young: 0,
    onboarding_start: 0,
    onboarding_tutorial: 0,
    onboarding_nickname: 0,
    onboarding_home: 0,
    hint_requests: 0,
    hint_uses: 0,
    ...over,
  }) as MetricRow;

describe("tap to board, cold and warm (20261202000301)", () => {
  it("is a card with CSV export, next to Tap to board", () => {
    expect(METRIC_IDS.indexOf("tap_warmth")).toBe(METRIC_IDS.indexOf("tap_to_board") + 1);
  });
  it("shows cold and warm p50, with each p95 and count", () => {
    const total = row({ cold_n: 40, cold_p50: 2400, cold_p95: 11_800, warm_n: 120, warm_p50: 650, warm_p95: 1900 });
    expect(METRIC_BY_ID.tap_warmth.headline(total)).toBe("2400 ms / 650 ms");
    expect(METRIC_BY_ID.tap_warmth.sub(total)).toBe("cold p50 / warm p50 · cold p95 11.8 s (40) · warm p95 1900 ms (120)");
    const csv = metricCsv("tap_warmth", { rows: [row({ date: "2026-12-02", cold_n: 2, cold_p50: 2000, cold_p95: 3000 })], total })
      .trimEnd()
      .split("\r\n");
    expect(csv).toEqual([
      "date,cold_count,cold_p50_ms,cold_p95_ms,warm_count,warm_p50_ms,warm_p95_ms",
      "2026-12-02,2,2000,3000,0,,",
      "total,40,2400,11800,120,650,1900",
    ]);
  });
  it("reads rows from before the migration as no data", () => {
    expect(METRIC_BY_ID.tap_warmth.headline(row())).toBe("n/a / n/a");
  });
});

describe("landing to first clear (20261202000401)", () => {
  it("writes long waits in words", () => {
    expect(span(null)).toBe("n/a");
    expect(span(42_000)).toBe("42 s");
    expect(span(5 * 60_000)).toBe("5 min");
    expect(span(3 * 3600_000)).toBe("3.0 h");
    expect(span(3 * 86_400_000)).toBe("3.0 d");
  });
  it("shows p50 / p95 and the share of new players who cleared one, with CSV", () => {
    const total = row({ fc_cohort: 8, fc_cleared: 6, fc_p50: 95_000, fc_p95: 7_200_000 });
    expect(METRIC_BY_ID.first_clear.headline(total)).toBe("2 min / 2.0 h");
    expect(METRIC_BY_ID.first_clear.sub(total)).toBe("p50 / p95 · 6 of 8 new players cleared one (75%)");
    const csv = metricCsv("first_clear", { rows: [row({ date: "2026-12-02", fc_cohort: 3 })], total })
      .trimEnd()
      .split("\r\n");
    expect(csv).toEqual(["date,new_players,cleared,cleared_pct,p50_ms,p95_ms", "2026-12-02,3,0,0,,", "total,8,6,75,95000,7200000"]);
  });
  it("reads rows from before the migration as no data", () => {
    expect(METRIC_BY_ID.first_clear.headline(row())).toBe("n/a / n/a");
    expect(METRIC_BY_ID.first_clear.sub(row())).toContain("(n/a)");
  });
});

describe("practice rounds (20261202000501)", () => {
  const total = row({
    practice_started: 10,
    practice_finished: 6,
    practice_skipped: 3,
    practice_games: { dusk: { started: 7, finished: 5, skipped: 1 }, nine: { started: 3, finished: 1, skipped: 2 } },
  });
  it("shows finish rate, skips and drop-off, never a negative drop-off", () => {
    expect(METRIC_BY_ID.practice.headline(total)).toBe("60%");
    expect(METRIC_BY_ID.practice.sub(total)).toBe("finished of 10 started · 3 skipped (30%) · 1 dropped (10%)");
    expect(practiceDropped({ started: 1, finished: 1, skipped: 1 })).toBe(0);
  });
  it("breaks down by game, busiest first, with the game's name", () => {
    expect(METRIC_BY_ID.practice.breakdown!.rows(total)).toEqual([
      { key: "dusk", label: "Dusk", values: [7, 5, 1, 1, 71.4] },
      { key: "nine", label: "Nine", values: [3, 1, 2, 0, 33.3] },
    ]);
  });
  it("exports per day and game, then the range total", () => {
    const day = row({ date: "2026-12-02", practice_started: 1, practice_games: { dusk: { started: 1, finished: 0, skipped: 0 } } });
    expect(
      metricCsv("practice", { rows: [day], total })
        .trimEnd()
        .split("\r\n"),
    ).toEqual([
      "date,game,started,finished,skipped,dropped,finish_pct",
      "2026-12-02,dusk,1,0,0,1,0",
      "2026-12-02,all,1,0,0,1,0",
      "total,dusk,7,5,1,1,71.4",
      "total,nine,3,1,2,0,33.3",
      "total,all,10,6,3,1,60",
    ]);
  });
  it("reads rows from before the migration as no data", () => {
    expect(METRIC_BY_ID.practice.headline(row())).toBe("n/a");
    expect(METRIC_BY_ID.practice.breakdown!.rows(row())).toEqual([]);
  });
});

describe("D1 and D7 retention cohorts (20261202000601)", () => {
  it("rates only the cohorts that are due, and shows n/a until then", () => {
    const total = row({ ret_cohort: 30, ret_d1_cohort: 20, ret_d1_kept: 9, ret_d7_cohort: 10, ret_d7_kept: 2 });
    expect([d1(total), d7(total)]).toEqual([45, 20]);
    expect(METRIC_BY_ID.retention.headline(total)).toBe("45% / 20%");
    expect(METRIC_BY_ID.retention.sub(total)).toBe("D1 / D7 · D1 9 of 20 · D7 2 of 10 · 30 new players");
    const recent = row({ date: "2026-12-06", ret_cohort: 4 }); // D1 and D7 not over yet
    const older = row({ date: "2026-11-20", ret_cohort: 5, ret_d1_cohort: 5, ret_d1_kept: 2, ret_d7_cohort: 5, ret_d7_kept: 0 });
    expect(
      metricCsv("retention", { rows: [older, recent], total })
        .trimEnd()
        .split("\r\n"),
    ).toEqual(["date,cohort,d1_kept,d1_pct,d7_kept,d7_pct", "2026-11-20,5,2,40,0,0", "2026-12-06,4,,,,", "total,30,9,45,2,20"]);
  });
  it("reads rows from before the migration as no data", () => {
    expect(METRIC_BY_ID.retention.headline(row())).toBe("n/a / n/a");
  });
});
