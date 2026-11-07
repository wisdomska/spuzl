import { describe, expect, it } from "vitest";
import { METRIC_BY_ID, METRIC_IDS, metricCsv, type MetricRow } from "./metrics";

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
