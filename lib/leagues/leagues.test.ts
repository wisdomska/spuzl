import { describe, expect, it } from "vitest";
import {
  formatLeft,
  isoWeek,
  leagueReward,
  msToLeagueReset,
  nextTier,
  ordinal,
  tierMeta,
  weekStartOf,
  zoneFor,
  PROMOTE,
  DEMOTE,
  TOP_TIER,
} from "./index";

describe("league zones", () => {
  it("promotes the top 7 and demotes the bottom 5 of 30", () => {
    const zones = Array.from({ length: 30 }, (_, i) => zoneFor(i + 1, 30, 2));
    expect(zones.filter((z) => z === "promote")).toHaveLength(PROMOTE);
    expect(zones.filter((z) => z === "demote")).toHaveLength(DEMOTE);
    expect(zones[6]).toBe("promote");
    expect(zones[7]).toBe("stay");
    expect(zones[24]).toBe("stay");
    expect(zones[25]).toBe("demote");
  });
  it("never promotes from the top tier or demotes from the bottom", () => {
    expect(zoneFor(1, 30, TOP_TIER)).toBe("stay");
    expect(zoneFor(30, 30, 0)).toBe("stay");
  });
  it("does not demote in small groups (matches the rollover)", () => {
    expect(zoneFor(12, 12, 2)).toBe("stay");
    expect(zoneFor(13, 13, 2)).toBe("demote");
  });
});

describe("league rewards and tiers", () => {
  it("pays the new tier's reward on promotion, half on staying, nothing on demotion", () => {
    expect(leagueReward("promoted", 0)).toBe(40);
    expect(leagueReward("promoted", 3)).toBe(150);
    expect(leagueReward("promoted", TOP_TIER)).toBe(150);
    expect(leagueReward("stayed", 2)).toBe(35);
    expect(leagueReward("demoted", 4)).toBe(0);
  });
  it("moves one tier and clamps at the ends", () => {
    expect(nextTier("promoted", 2)).toBe(3);
    expect(nextTier("promoted", TOP_TIER)).toBe(TOP_TIER);
    expect(nextTier("demoted", 0)).toBe(0);
    expect(nextTier("stayed", 1)).toBe(1);
  });
  it("names every tier and clamps out of range", () => {
    expect(tierMeta(2).name).toBe("Gold Crown");
    expect(tierMeta(-1).name).toBe("Bronze Block");
    expect(tierMeta(9).name).toBe("Cosmic Spuz");
  });
});

describe("league clock", () => {
  it("weeks start Monday 00:00 GMT", () => {
    expect(weekStartOf(new Date("2026-10-31T12:00:00Z"))).toBe("2026-10-26");
    expect(weekStartOf(new Date("2026-11-02T00:00:00Z"))).toBe("2026-11-02");
    expect(weekStartOf(new Date("2026-11-01T23:59:59Z"))).toBe("2026-10-26");
  });
  it("counts down to next Monday", () => {
    expect(msToLeagueReset(new Date("2026-11-01T23:00:00Z"))).toBe(3_600_000);
  });
  it("formats time left", () => {
    expect(formatLeft((2 * 24 + 14) * 3_600_000 + 5 * 60_000)).toBe("2d 14h");
    expect(formatLeft(5 * 3_600_000 + 12 * 60_000)).toBe("5h 12m");
    expect(formatLeft(9 * 60_000)).toBe("9m");
    expect(formatLeft(-5)).toBe("0m");
  });
  it("numbers weeks and places", () => {
    expect(isoWeek("2026-10-19")).toBe(43);
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(5)).toBe("5th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
  });
});
