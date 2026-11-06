import { describe, expect, it } from "vitest";
import { MAX_SAMPLES, addSample, lowDataTrigger, parseSamples, shouldSuggestLowData, slowRun } from "./suggest";
import { DEFAULTS } from "@/lib/game-settings/schema";

const rule = { thresholdMs: DEFAULTS["prompts.lowDataThresholdMs"], slowLoads: DEFAULTS["prompts.lowDataSlowLoads"] };

describe("low-data suggestion timing (SPZ-27a, R2-04)", () => {
  it("defaults to two loads over 4 s in a row", () => {
    expect(rule).toEqual({ thresholdMs: 4000, slowLoads: 2 });
  });

  it("counts the latest run of slow loads; one fast load resets it", () => {
    expect(slowRun([], 4000)).toBe(0);
    expect(slowRun([5000, 6000], 4000)).toBe(2);
    expect(slowRun([5000, 900, 6000], 4000)).toBe(1);
    expect(slowRun([5000, 6000, 900], 4000)).toBe(0);
    expect(slowRun([4000], 4000)).toBe(0); // at the threshold is not over it
  });

  it("needs N slow loads in a row (slow_loads)", () => {
    expect(lowDataTrigger({ ...rule, samples: [5000] })).toBeNull();
    expect(lowDataTrigger({ ...rule, samples: [5000, 4500] })).toBe("slow_loads");
    expect(lowDataTrigger({ ...rule, samples: [5000, 800, 4500] })).toBeNull();
    expect(lowDataTrigger({ ...rule, slowLoads: 1, samples: [4500] })).toBe("slow_loads");
    expect(lowDataTrigger({ ...rule, thresholdMs: 6000, samples: [5000, 5500] })).toBeNull();
  });

  it("lets a 2G/3G estimate shorten the wait to one slow load, never replace it (slow_net)", () => {
    for (const effectiveType of ["slow-2g", "2g", "3g"]) {
      expect(lowDataTrigger({ ...rule, effectiveType, samples: [5000] })).toBe("slow_net");
      expect(lowDataTrigger({ ...rule, effectiveType, samples: [] })).toBeNull();
      expect(lowDataTrigger({ ...rule, effectiveType, samples: [5000, 700] })).toBeNull();
    }
    expect(lowDataTrigger({ ...rule, effectiveType: "4g", samples: [5000] })).toBeNull();
  });

  it("never fires on a fast connection", () => {
    expect(lowDataTrigger({ ...rule, effectiveType: "4g", samples: [600, 900, 1200, 800, 700] })).toBeNull();
    expect(lowDataTrigger({ ...rule, effectiveType: null, samples: [3999, 3999] })).toBeNull();
  });

  it("asks once a session, never with low-data mode already on", () => {
    expect(shouldSuggestLowData({ lowData: false, askedThisSession: false, trigger: "slow_loads" })).toBe(true);
    expect(shouldSuggestLowData({ lowData: true, askedThisSession: false, trigger: "slow_loads" })).toBe(false);
    expect(shouldSuggestLowData({ lowData: false, askedThisSession: true, trigger: "slow_net" })).toBe(false);
    expect(shouldSuggestLowData({ lowData: false, askedThisSession: false, trigger: null })).toBe(false);
  });

  it("keeps the last few sane measurements", () => {
    let s: number[] = [];
    for (let i = 1; i <= 8; i++) s = addSample(s, i * 1000);
    expect(s).toHaveLength(MAX_SAMPLES);
    expect(s.at(-1)).toBe(8000);
    expect(addSample([1], Number.NaN)).toEqual([1]);
    expect(addSample([1], -5)).toEqual([1]);
    expect(addSample([1], 200_000)).toEqual([1]);
    expect(parseSamples('[1,"x",3]')).toEqual([1, 3]);
    expect(parseSamples("nope")).toEqual([]);
    expect(parseSamples(null)).toEqual([]);
  });
});
