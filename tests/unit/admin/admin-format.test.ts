import { describe, expect, it } from "vitest";
import { exactTime, fmtDay, fmtDuration, fmtNum, fmtPct, timeAgo } from "@/components/admin/ui";

/** Admin overhaul, principle 5: human formats for numbers, durations, days and times. */
describe("admin human formats", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  it("says how long ago, with the exact time kept for the tooltip", () => {
    expect(timeAgo("2026-11-11T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-11-11T11:55:00Z", now)).toBe("5 minutes ago");
    expect(timeAgo("2026-11-11T11:00:00Z", now)).toBe("1 hour ago");
    expect(timeAgo("2026-11-11T10:00:00Z", now)).toBe("2 hours ago");
    expect(timeAgo("2026-11-10T12:00:00Z", now)).toBe("yesterday");
    expect(timeAgo("2026-11-08T12:00:00Z", now)).toBe("3 days ago");
    expect(timeAgo("2026-10-01T12:00:00Z", now)).toBe("Thu 1 Oct");
    expect(timeAgo("2026-11-11T14:00:00Z", now)).toBe("in 2 hours");
    expect(exactTime("2026-11-11T14:05:00Z")).toBe("Wed 11 Nov 2026, 14:05 GMT");
    expect(fmtDay("2026-11-11")).toBe("Wed 11 Nov");
  });
  it("writes durations, numbers and shares for people", () => {
    expect(fmtDuration(4_000)).toBe("4 s");
    expect(fmtDuration(80_000)).toBe("1 min 20 s");
    expect(fmtDuration(120_000)).toBe("2 min");
    expect(fmtDuration(3_720_000)).toBe("1 h 2 min");
    expect(fmtDuration(null)).toBe("–");
    expect(fmtNum(12345)).toBe("12,345");
    expect(fmtNum(null)).toBe("–");
    expect(fmtPct(0.4567)).toBe("46%");
    expect(fmtPct(3, 4)).toBe("75%");
    expect(fmtPct(3, 0)).toBe("0%");
  });
});
