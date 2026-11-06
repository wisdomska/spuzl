import { describe, expect, it } from "vitest";
import { DEFAULT_META, durationLabel, filterGames, matchesQuery, validateMeta } from "./index";
import { RACE_GAMES } from "@/lib/multiplayer/games";
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

describe("filterGames (Library and the Duel game picker)", () => {
  const races = RACE_GAMES;
  it("All and an empty search keep every game", () => {
    expect(filterGames(races, "all", "", DEFAULT_META)).toHaveLength(races.length);
  });
  it("filters by world, by tag and by search, together", () => {
    const world = races[0].world;
    const byWorld = filterGames(races, world, "", DEFAULT_META);
    expect(byWorld.length).toBeGreaterThan(0);
    expect(byWorld.every((g) => g.world === world)).toBe(true);
    const quick = filterGames(races, "quick", "", DEFAULT_META);
    expect(quick.every((g) => DEFAULT_META[g.id].tags.includes("quick"))).toBe(true);
    expect(filterGames(races, "all", races[0].name.toUpperCase(), DEFAULT_META).map((g) => g.id)).toContain(races[0].id);
    expect(filterGames(races, world, "zzzz-no-such-game", DEFAULT_META)).toEqual([]);
  });
  it("uses admin tag overrides", () => {
    const id = races[0].id;
    const meta = { ...DEFAULT_META, [id]: { typicalSec: 60, tags: ["calm" as const] } };
    expect(filterGames(races, "calm", "", meta).map((g) => g.id)).toContain(id);
    expect(filterGames(races, "competitive", "", meta).map((g) => g.id)).not.toContain(id);
  });
});
