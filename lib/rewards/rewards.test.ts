import { describe, expect, it } from "vitest";
import { dailyClearReward, freePlayReward, levelFromXp, speedBonus, xpForLevel, flameTier, FREE_XP_DAILY_CAP } from "./index";
import { update, DEFAULT_RATING, dailyResult, rankFor } from "@/lib/rating/glicko2";

describe("rewards", () => {
  it("matches the designed Results screen: no hints, 0 slips, fast = +120 XP, +25 Sparks", () => {
    const r = dailyClearReward({ timeMs: 72_000, hints: 0, mistakes: 0, medianMs: 96_000, firstClearOfGameEver: false });
    expect(r.xp).toBe(120);
    expect(r.sparks).toBe(25);
  });
  it("speed bonus scales 10 to 40 and only under the median", () => {
    expect(speedBonus(100, null)).toBe(0);
    expect(speedBonus(100, 100)).toBe(0);
    expect(speedBonus(99, 100)).toBe(11);
    expect(speedBonus(50, 100)).toBe(40);
    expect(speedBonus(1, 100)).toBe(40);
  });
  it("halves XP when hints were used and for archive clears", () => {
    const base = dailyClearReward({ timeMs: 200_000, hints: 0, mistakes: 1, medianMs: 100_000, firstClearOfGameEver: false });
    expect(base.xp).toBe(75);
    const hinted = dailyClearReward({ timeMs: 200_000, hints: 1, mistakes: 1, medianMs: 100_000, firstClearOfGameEver: false });
    expect(hinted.xp).toBe(25);
    const archive = dailyClearReward({ timeMs: 200_000, hints: 0, mistakes: 1, medianMs: 100_000, firstClearOfGameEver: false, archive: true });
    expect(archive.xp).toBe(37);
    expect(archive.sparks).toBe(0);
  });
  it("first clear of a game adds 100, deaths break perfect, relaxed gets no speed bonus", () => {
    expect(dailyClearReward({ timeMs: 1, hints: 0, mistakes: 0, medianMs: null, firstClearOfGameEver: true }).xp).toBe(195);
    expect(dailyClearReward({ timeMs: 1, hints: 0, mistakes: 0, deaths: 3, medianMs: null, firstClearOfGameEver: false }).xp).toBe(75);
    expect(dailyClearReward({ timeMs: 1, hints: 0, mistakes: 0, medianMs: 1000, firstClearOfGameEver: false, relaxed: true }).xp).toBe(95);
  });
  it("free play: +10 XP, +5 Sparks, capped at 300 XP a day, duplicates earn nothing", () => {
    expect(freePlayReward(0, false)).toMatchObject({ xp: 10, sparks: 5 });
    expect(freePlayReward(295, false)).toMatchObject({ xp: 5, sparks: 5 });
    expect(freePlayReward(FREE_XP_DAILY_CAP, false)).toMatchObject({ xp: 0, sparks: 0 });
    expect(freePlayReward(0, true)).toMatchObject({ xp: 0, sparks: 0 });
  });
  it("levels follow 100 × n^1.4 rounded to 10", () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(10)).toBe(2510);
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, need: 100 });
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(-5).level).toBe(1);
    const total = Array.from({ length: 13 }, (_, i) => xpForLevel(i + 1)).reduce((a, b) => a + b, 0);
    expect(levelFromXp(total).level).toBe(14);
  });
  it("flame tiers", () => {
    expect(flameTier(1)).toBe("orange");
    expect(flameTier(7)).toBe("blue");
    expect(flameTier(30)).toBe("purple");
    expect(flameTier(365)).toBe("prism");
  });
});

describe("glicko-2", () => {
  it("reproduces Glickman's worked example", () => {
    const p = { rating: 1500, rd: 200, vol: 0.06 };
    const out = update(p, [
      { opponent: { rating: 1400, rd: 30, vol: 0.06 }, score: 1 },
      { opponent: { rating: 1550, rd: 100, vol: 0.06 }, score: 0 },
      { opponent: { rating: 1700, rd: 300, vol: 0.06 }, score: 0 },
    ]);
    expect(out.rating).toBeCloseTo(1464.06, 1);
    expect(out.rd).toBeCloseTo(151.52, 1);
    expect(out.vol).toBeCloseTo(0.05999, 4);
  });
  it("idle periods widen RD; wins raise rating", () => {
    expect(update(DEFAULT_RATING, []).rd).toBeGreaterThanOrEqual(DEFAULT_RATING.rd - 1);
    const won = update(DEFAULT_RATING, [dailyResult(90, 0, 0)]);
    expect(won.rating).toBeGreaterThan(1000);
    const lost = update(DEFAULT_RATING, [dailyResult(10, 2, 3)]);
    expect(lost.rating).toBeLessThan(1000);
  });
  it("maps ratings to ranks and divisions", () => {
    expect(rankFor(950)).toMatchObject({ name: "Rookie" });
    expect(rankFor(1000)).toMatchObject({ name: "Thinker", division: "III" });
    expect(rankFor(1199)).toMatchObject({ name: "Thinker", division: "I" });
    expect(rankFor(1650).name).toBe("Mastermind");
    expect(rankFor(1900)).toMatchObject({ name: "Legend", division: "" });
  });
});
