import { describe, expect, it } from "vitest";
import { activityOf, dayDate, daysSince, duration, exactTime, timeAgo, timeUntil } from "./people-format";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const before = (ms: number) => new Date(NOW - ms).toISOString();
const after = (ms: number) => new Date(NOW + ms).toISOString();
const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;

describe("people-format", () => {
  it("timeAgo reads like a person would say it", () => {
    expect(timeAgo(before(20_000), NOW)).toBe("just now");
    expect(timeAgo(before(5 * MIN), NOW)).toBe("5 min ago");
    expect(timeAgo(before(H), NOW)).toBe("1 hour ago");
    expect(timeAgo(before(3 * H + 10 * MIN), NOW)).toBe("3 hours ago");
    expect(timeAgo(before(D + H), NOW)).toBe("yesterday");
    expect(timeAgo(before(4 * D), NOW)).toBe("4 days ago");
    expect(timeAgo(before(20 * D), NOW)).toBe("2 weeks ago");
    expect(timeAgo("2026-07-01T09:00:00Z", NOW)).toBe("Wed 1 Jul");
    expect(timeAgo("2025-11-03T09:00:00Z", NOW)).toBe("Mon 3 Nov 2025");
    expect(timeAgo(null, NOW)).toBe("");
    expect(timeAgo("not a date", NOW)).toBe("");
  });

  it("timeUntil for ban ends", () => {
    expect(timeUntil(after(30 * MIN), NOW)).toBe("in 30 min");
    expect(timeUntil(after(5 * H), NOW)).toBe("in 5 hours");
    expect(timeUntil(after(D), NOW)).toBe("tomorrow");
    expect(timeUntil(after(7 * D), NOW)).toBe("in 7 days");
    expect(timeUntil(after(30 * D), NOW)).toBe("on Fri 11 Dec");
    expect(timeUntil(before(MIN), NOW)).toBe("any moment now");
  });

  it("dates and exact times are GMT", () => {
    expect(dayDate("2026-11-11", NOW)).toBe("Wed 11 Nov");
    expect(dayDate("2026-11-11T23:59:00Z", NOW)).toBe("Wed 11 Nov");
    expect(exactTime("2026-11-11T09:05:00Z")).toBe("Wed 11 Nov 2026, 09:05 GMT");
    expect(exactTime(null)).toBe("");
  });

  it("durations in words", () => {
    expect(duration(45_000)).toBe("45 s");
    expect(duration(80_000)).toBe("1 min 20 s");
    expect(duration(120_000)).toBe("2 min");
    expect(duration(2 * H + 5 * MIN)).toBe("2 h 5 min");
    expect(duration(null)).toBe("");
  });

  it("activity bands", () => {
    expect(activityOf(before(MIN), NOW)).toBe("now");
    expect(activityOf(before(3 * H), NOW)).toBe("today");
    expect(activityOf(before(3 * D), NOW)).toBe("week");
    expect(activityOf(before(10 * D), NOW)).toBe("month");
    expect(activityOf(before(40 * D), NOW)).toBe("quiet");
    expect(activityOf(null, NOW)).toBe("never");
    expect(daysSince(before(3 * D + H), NOW)).toBe(3);
  });
});
