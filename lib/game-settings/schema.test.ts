import { describe, expect, it } from "vitest";
import { DEFAULTS, SETTINGS, mergeSettings, sameSetting, validateSetting } from "./schema";

describe("game settings schema", () => {
  it("every default passes its own validation", () => {
    for (const [k, d] of Object.entries(SETTINGS)) expect(validateSetting(k, d.default), k).toBeNull();
  });
  it("enforces ranges, types and known keys", () => {
    expect(validateSetting("hints.dailyXpKeptPct", 101)).toMatch(/between 0 and 100/);
    expect(validateSetting("hints.dailyXpKeptPct", 12.5)).toMatch(/whole number/);
    expect(validateSetting("perf.prefetch", "yes")).toMatch(/on or off/);
    expect(validateSetting("nope", 1)).toMatch(/Unknown/);
    expect(validateSetting("free.xpDailyCap", 5001)).toMatch(/between 0 and 5000/);
    expect(validateSetting("free.sparksPerClear", -1)).toMatch(/between 0 and 50/);
  });
  it("free-play economy defaults match the original design (+10 XP, +5 Sparks, 300 XP a day)", () => {
    expect(DEFAULTS["free.xpPerClear"]).toBe(10);
    expect(DEFAULTS["free.sparksPerClear"]).toBe(5);
    expect(DEFAULTS["free.xpDailyCap"]).toBe(300);
  });
  it("prompt timing settings (R2-04): ranges and a set of triggers", () => {
    expect(validateSetting("prompts.alertsCooldownDays", 0)).toMatch(/between 1 and 30/);
    expect(validateSetting("prompts.alertsCooldownDays", 31)).toMatch(/between 1 and 30/);
    expect(validateSetting("prompts.alertsStreakDays", 1)).toMatch(/between 2 and 14/);
    expect(validateSetting("prompts.lowDataThresholdMs", 1999)).toMatch(/between 2000 and 15000/);
    expect(validateSetting("prompts.lowDataSlowLoads", 6)).toMatch(/between 1 and 5/);
    expect(validateSetting("prompts.alertsTriggers", ["friend", "streak"])).toBeNull();
    expect(validateSetting("prompts.alertsTriggers", [])).toBeNull();
    expect(validateSetting("prompts.alertsTriggers", ["friend", "friend"])).toMatch(/at most once/);
    expect(validateSetting("prompts.alertsTriggers", ["birthday"])).toMatch(/list of/);
    expect(validateSetting("prompts.alertsTriggers", "friend")).toMatch(/list of/);
    expect(validateSetting("prompts.alertsTriggers", 3)).toMatch(/list of/);
    const s = mergeSettings([
      { key: "prompts.alertsTriggers", value: ["invite"] },
      { key: "prompts.lowDataSlowLoads", value: 3 },
    ]);
    expect(s["prompts.alertsTriggers"]).toEqual(["invite"]);
    expect(s["prompts.lowDataSlowLoads"]).toBe(3);
    expect(mergeSettings([{ key: "prompts.alertsTriggers", value: ["nope"] }])["prompts.alertsTriggers"]).toEqual(
      DEFAULTS["prompts.alertsTriggers"],
    );
    expect(sameSetting(["streak", "friend"], ["friend", "streak"])).toBe(true);
    expect(sameSetting(["friend"], ["friend", "streak"])).toBe(false);
    expect(sameSetting(3, 3)).toBe(true);
  });

  it("merges stored rows over defaults and ignores bad rows", () => {
    const s = mergeSettings([
      { key: "duel.roundResultMs", value: 3000 },
      { key: "quickfire.autoAdvanceMs", value: 99 },
      { key: "ghost.key", value: 1 },
    ]);
    expect(s["duel.roundResultMs"]).toBe(3000);
    expect(s["quickfire.autoAdvanceMs"]).toBe(DEFAULTS["quickfire.autoAdvanceMs"]);
    expect(Object.keys(s)).toEqual(Object.keys(DEFAULTS));
  });
});

describe("party.countdownSeconds (R2-03)", () => {
  it("defaults to 3 (3, 2, 1) and allows 2 to 5", () => {
    expect(DEFAULTS["party.countdownSeconds"]).toBe(3);
    expect(validateSetting("party.countdownSeconds", 2)).toBeNull();
    expect(validateSetting("party.countdownSeconds", 5)).toBeNull();
    expect(validateSetting("party.countdownSeconds", 1)).toMatch(/between 2 and 5/);
    expect(validateSetting("party.countdownSeconds", 6)).toMatch(/between 2 and 5/);
    expect(SETTINGS["party.countdownSeconds"].help.length).toBeGreaterThan(20);
  });
});
