import { describe, expect, it } from "vitest";
import { DEFAULT_META, durationLabel, matchesQuery, validateMeta } from "./index";
import { GAMES, LAB_GAMES, RETIRED_GAMES } from "@/lib/catalog";

describe("Library metadata (SPZ-14)", () => {
  it("has a duration and valid tags for every live and lab game, none for retired ones", () => {
    expect(Object.keys(DEFAULT_META)).toHaveLength(GAMES.length + LAB_GAMES.length);
    for (const [id, m] of Object.entries(DEFAULT_META)) expect(validateMeta(m), id).toBeNull();
    for (const g of RETIRED_GAMES) expect(DEFAULT_META[g.id], g.id).toBeUndefined();
  });
  it("labels durations", () => {
    expect(durationLabel(45)).toBe("Under 1 min");
    expect(durationLabel(110)).toBe("2 min");
  });
  it("rejects bad overrides", () => {
    expect(validateMeta({ typicalSec: 5 })).toMatch(/between 10 and 3600/);
    expect(validateMeta({ tags: ["quick", "quick"] })).toMatch(/distinct/);
    expect(validateMeta({ tags: ["fun"] })).toMatch(/distinct values/);
  });
  it("searches name, world and blurb ignoring case and accents", () => {
    expect(matchesQuery("Crownfall Logic Lab", "logic crown")).toBe(true);
    expect(matchesQuery("Café", "cafe")).toBe(true);
    expect(matchesQuery("Crownfall", "dusk")).toBe(false);
  });
});
