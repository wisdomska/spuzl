import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  ROLLOVER_MIN_MS,
  ROLLOVER_SPREAD_MS,
  gmtDay,
  msUntilNextGmtDay,
  needsDailyPack,
  packGames,
  rolloverDelayMs,
} from "./daily-pack";

const at = (iso: string) => Date.parse(iso);

describe("daily pack timing (SPZ-27b)", () => {
  it("names the GMT day, not the local one", () => {
    expect(gmtDay(at("2026-11-01T23:59:59.999Z"))).toBe("2026-11-01");
    expect(gmtDay(at("2026-11-02T00:00:00.000Z"))).toBe("2026-11-02");
    expect(gmtDay(at("2026-11-01T23:30:00-05:00"))).toBe("2026-11-02");
  });

  it("counts down to the next GMT midnight", () => {
    expect(msUntilNextGmtDay(at("2026-11-01T23:00:00Z"))).toBe(3_600_000);
    expect(msUntilNextGmtDay(at("2026-11-01T23:59:59.999Z"))).toBe(1);
    // exactly at midnight the new day has started: the next rollover is a full day away
    expect(msUntilNextGmtDay(at("2026-11-02T00:00:00Z"))).toBe(DAY_MS);
  });

  it("lands 1 to 5 minutes after midnight, spread per device", () => {
    const now = at("2026-11-01T22:00:00Z");
    const midnight = at("2026-11-02T00:00:00Z");
    expect(now + rolloverDelayMs(now, 0)).toBe(midnight + ROLLOVER_MIN_MS);
    const late = now + rolloverDelayMs(now, 0.9999);
    expect(late).toBeLessThan(midnight + ROLLOVER_MIN_MS + ROLLOVER_SPREAD_MS);
    expect(late).toBeGreaterThan(midnight + ROLLOVER_MIN_MS);
    // bad slots fall back to the earliest moment, never before midnight
    expect(now + rolloverDelayMs(now, Number.NaN)).toBe(midnight + ROLLOVER_MIN_MS);
    expect(now + rolloverDelayMs(now, -3)).toBe(midnight + ROLLOVER_MIN_MS);
    expect(now + rolloverDelayMs(now, 7)).toBeLessThan(midnight + ROLLOVER_MIN_MS + ROLLOVER_SPREAD_MS);
  });

  it("never schedules a fetch before the day starts", () => {
    for (let h = 0; h < 24; h++) {
      const now = at(`2026-11-01T${String(h).padStart(2, "0")}:17:00Z`);
      expect(gmtDay(now + rolloverDelayMs(now, 0.5))).toBe("2026-11-02");
    }
  });

  it("needs a pack once per GMT day", () => {
    const now = at("2026-11-02T00:03:00Z");
    expect(needsDailyPack(null, now)).toBe(true);
    expect(needsDailyPack("2026-11-01", now)).toBe(true);
    expect(needsDailyPack("2026-11-02", now)).toBe(false);
  });

  it("packs ready, uncleared launch Dailies only", () => {
    const games = [
      { id: "crownfall", ready: true, state: "new" as const },
      { id: "sudoku", ready: true, state: "cleared" as const },
      { id: "nonogram", ready: false, state: "new" as const },
      { id: "chess", ready: true, state: "new" as const },
      { id: "kenken", ready: true, state: "in_progress" as const },
    ];
    expect(packGames(games, ["crownfall", "sudoku", "nonogram", "kenken"])).toEqual(["crownfall", "kenken"]);
  });
});
