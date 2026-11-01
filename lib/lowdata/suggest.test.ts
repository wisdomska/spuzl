import { describe, expect, it } from "vitest";
import { SLOW_LOAD_MS, isSlowConnection, shouldSuggestLowData } from "./suggest";

describe("low-data suggestion (SPZ-27a)", () => {
  it("treats Save-Data and 2G/3G as slow", () => {
    expect(isSlowConnection({ saveData: true })).toBe(true);
    for (const t of ["slow-2g", "2g", "3g"]) expect(isSlowConnection({ effectiveType: t })).toBe(true);
    expect(isSlowConnection({ effectiveType: "4g", saveData: false })).toBe(false);
  });

  it("treats a first load over 4 s as slow", () => {
    expect(isSlowConnection({ responseEndMs: SLOW_LOAD_MS + 1 })).toBe(true);
    expect(isSlowConnection({ responseEndMs: SLOW_LOAD_MS })).toBe(false);
    expect(isSlowConnection({ responseEndMs: 900, effectiveType: "4g" })).toBe(false);
    expect(isSlowConnection({ responseEndMs: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it("knows nothing means not slow", () => {
    expect(isSlowConnection({})).toBe(false);
    expect(isSlowConnection({ effectiveType: null, saveData: null, responseEndMs: null })).toBe(false);
  });

  it("asks once, and never when low-data mode is already on", () => {
    const slow = { effectiveType: "2g" };
    expect(shouldSuggestLowData({ lowData: false, answered: false, ...slow })).toBe(true);
    expect(shouldSuggestLowData({ lowData: true, answered: false, ...slow })).toBe(false);
    expect(shouldSuggestLowData({ lowData: false, answered: true, ...slow })).toBe(false);
    expect(shouldSuggestLowData({ lowData: false, answered: false, effectiveType: "4g" })).toBe(false);
  });
});
