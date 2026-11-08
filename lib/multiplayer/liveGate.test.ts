import { describe, expect, it } from "vitest";
import { canPlayLive, quickMatchPool } from "./liveGate";

const today = new Date(Date.UTC(2026, 10, 6)); // 6 Nov 2026

describe("canPlayLive (Quick Match and Play live)", () => {
  it("keeps 13 to 15 out and lets 16+ in, by stored band", () => {
    expect(canPlayLive({ age_band: "13-15" }, today)).toBe(false);
    expect(canPlayLive({ age_band: "16-17" }, today)).toBe(true);
    expect(canPlayLive({ age_band: "18+" }, today)).toBe(true);
  });

  it("reads the effective band from birth month and year over a stale stored band", () => {
    // Born Jan 2011: 15 on 6 Nov 2026, whatever the stored column still says.
    expect(canPlayLive({ age_band: "18+", birth_year: 2011, birth_month: 1 }, today)).toBe(false);
    // Born Oct 2010: turned 16 on 1 Nov 2026, before the daily refresh moved the stored band.
    expect(canPlayLive({ age_band: "13-15", birth_year: 2010, birth_month: 10 }, today)).toBe(true);
    // Born Nov 2010: still 15 until 1 Dec 2026.
    expect(canPlayLive({ age_band: "13-15", birth_year: 2010, birth_month: 11 }, today)).toBe(false);
  });

  it("treats a missing or unknown band as under 16", () => {
    expect(canPlayLive({}, today)).toBe(false);
    expect(canPlayLive({ age_band: null }, today)).toBe(false);
    expect(canPlayLive({ age_band: "adult" }, today)).toBe(false);
  });
});

describe("quickMatchPool (R3-06: Quick Match by band)", () => {
  it("puts 13 to 15 in the under-16 pool and 16+ in the open pool", () => {
    expect(quickMatchPool({ age_band: "13-15" }, today)).toBe("u16");
    expect(quickMatchPool({ age_band: "16-17" }, today)).toBe("open");
    expect(quickMatchPool({ age_band: "18+" }, today)).toBe("open");
  });

  it("reads the effective band: a stale stored 18+ never puts a 15-year-old with adults", () => {
    expect(quickMatchPool({ age_band: "18+", birth_year: 2011, birth_month: 1 }, today)).toBe("u16");
    expect(quickMatchPool({ age_band: "13-15", birth_year: 2010, birth_month: 10 }, today)).toBe("open");
    expect(quickMatchPool({ age_band: "13-15", birth_year: 2010, birth_month: 11 }, today)).toBe("u16");
  });

  it("refuses an unknown band (no pool to place it in)", () => {
    expect(quickMatchPool({}, today)).toBeNull();
    expect(quickMatchPool({ age_band: null }, today)).toBeNull();
    expect(quickMatchPool({ age_band: "adult" }, today)).toBeNull();
  });
});
