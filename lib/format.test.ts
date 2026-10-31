import { describe, expect, it } from "vitest";
import { dailyNumber, dailySeed, formatClock, formatCountdown, formatShort, msToReset, weekStartGmt } from "./format";

describe("format", () => {
  it("formats clocks and countdowns", () => {
    expect(formatClock(72_000)).toBe("01:12");
    expect(formatShort(72_400)).toBe("1:12");
    expect(formatCountdown(3 * 3600_000 + 42 * 60_000 + 10_000)).toBe("03:42:10");
  });
  it("numbers Dailies from launch, #214 on 2026-10-31", () => {
    expect(dailyNumber("2026-04-01")).toBe(1);
    expect(dailyNumber("2026-10-31")).toBe(214);
  });
  it("counts down to 00:00 GMT", () => {
    expect(msToReset(new Date("2026-10-31T23:59:00Z"))).toBe(60_000);
  });
  it("gives Gauntlet one seed per GMT week, other games one per day", () => {
    expect(weekStartGmt("2026-11-01")).toBe("2026-10-26"); // Sunday belongs to the week starting Monday
    expect(weekStartGmt("2026-11-02")).toBe("2026-11-02");
    expect(dailySeed("gauntlet", "2026-11-03")).toBe(dailySeed("gauntlet", "2026-11-08"));
    expect(dailySeed("gauntlet", "2026-11-08")).not.toBe(dailySeed("gauntlet", "2026-11-09"));
    expect(dailySeed("crownfall", "2026-11-03")).toBe("daily:crownfall:2026-11-03");
  });
});
