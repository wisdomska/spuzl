import { describe, expect, it } from "vitest";
import { METRIC_BY_ID, METRIC_IDS, metricCsv, type MetricRow } from "./metrics";

/** Round 3 Metrics cards. Older API rows lack the new fields: they read as zero. */
const row = (over: Partial<MetricRow> = {}) => ({ ...over }) as MetricRow;

describe("streak-at-risk nudges (R3-09, 20261207000901)", () => {
  it("shows the share of nudged players who cleared within 3 hours, with CSV", () => {
    const total = row({ sn_sent: 40, sn_cleared: 10 });
    expect(METRIC_IDS).toContain("streak_nudge");
    expect(METRIC_BY_ID.streak_nudge.headline(total)).toBe("25%");
    expect(METRIC_BY_ID.streak_nudge.sub(total)).toBe("cleared within 3 h · 10 of 40 nudges sent");
    const csv = metricCsv("streak_nudge", { rows: [row({ date: "2026-11-09", sn_sent: 4, sn_cleared: 1 })], total });
    expect(csv.trimEnd().split("\r\n")).toEqual(["date,sent,cleared_3h,cleared_pct", "2026-11-09,4,1,25", "total,40,10,25"]);
  });
  it("reads rows from before the migration as no data", () => {
    expect(METRIC_BY_ID.streak_nudge.headline(row())).toBe("n/a");
    expect(METRIC_BY_ID.streak_nudge.cols.map((c) => c.value(row()))).toEqual([0, 0, null]);
  });
});
