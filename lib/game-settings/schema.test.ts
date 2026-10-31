import { describe, expect, it } from "vitest";
import { DEFAULTS, SETTINGS, mergeSettings, validateSetting } from "./schema";

describe("game settings schema", () => {
  it("every default passes its own validation", () => {
    for (const [k, d] of Object.entries(SETTINGS)) expect(validateSetting(k, d.default), k).toBeNull();
  });
  it("enforces ranges, types and known keys", () => {
    expect(validateSetting("hints.dailyXpKeptPct", 101)).toMatch(/between 0 and 100/);
    expect(validateSetting("hints.dailyXpKeptPct", 12.5)).toMatch(/whole number/);
    expect(validateSetting("perf.prefetch", "yes")).toMatch(/on or off/);
    expect(validateSetting("nope", 1)).toMatch(/Unknown/);
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
