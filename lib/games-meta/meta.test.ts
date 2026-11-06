import { describe, expect, it } from "vitest";
import { DEFAULT_META, durationLabel, filterGames, matchesQuery, newGameIds, parseFilter, validateMeta } from "./index";
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

describe("the new tag (R2-18)", () => {
  it("defaults to the catalog's isNew games, three today", () => {
    const fresh = GAMES.filter((g) => g.isNew).map((g) => g.id);
    expect([...fresh].sort()).toEqual(["beattap", "emojihits", "trotro"]);
    expect(newGameIds(GAMES, DEFAULT_META)).toEqual(fresh);
    expect(validateMeta({ tags: ["new", "quick"] })).toBeNull();
  });
  it("follows admin overrides and filters the Library", () => {
    const meta = { ...DEFAULT_META, crownfall: { typicalSec: 110, tags: ["new" as const] }, trotro: { typicalSec: 120, tags: [] } };
    const ids = newGameIds(GAMES, meta);
    expect(ids).toContain("crownfall");
    expect(ids).not.toContain("trotro");
    expect(filterGames(GAMES, "new", "", meta).map((g) => g.id)).toEqual(ids);
  });
  it("reads a filter from the URL, falling back to All", () => {
    expect(parseFilter("new")).toBe("new");
    expect(parseFilter("quick")).toBe("quick");
    expect(parseFilter("logic")).toBe("logic");
    expect(parseFilter("number")).toBe("all"); // a world with no live games
    expect(parseFilter("<script>")).toBe("all");
    expect(parseFilter(null)).toBe("all");
  });
});
