import { describe, expect, it } from "vitest";
import {
  ALL_GAMES,
  ALL_WORLDS,
  GAMES,
  GAME_BY_ID,
  GAME_COUNT,
  LAB_GAMES,
  LAUNCH_IDS,
  RETIRED_GAMES,
  RETIRED_IDS,
  WORLDS,
  WORLD_BY_ID,
  WORLD_COUNT,
  gamesInWorld,
  isLabGame,
  isLiveGame,
  isLiveWorld,
  isRetired,
  playableGame,
} from "./catalog";
import { RACE_GAMES, PARTY_GAME_IDS, isRaceGame, pickGames } from "./multiplayer/games";
import { CLASSROOM_GAMES } from "./meta";
import { DEFAULT_META } from "./games-meta";
import { aboutCopy } from "./copy/about";
import { libraryCopy } from "./copy/library";
import { siteCopy } from "./copy/site";
import { copy } from "./copy";
import { createRng } from "./rng";

const KEEP = [
  "crownfall",
  "dusk",
  "sixer",
  "nine",
  "weave",
  "flowline",
  "pairup",
  "lost",
  "trotro",
  "coil",
  "rungs",
  "seven",
  "minicross",
  "buried",
  "remix",
  "quickfire",
  "emojihits",
  "echo",
  "twins",
  "flinch",
  "beattap",
  "gotcha",
  "dash",
  "gauntlet",
  "chess",
  "draughts",
  "oware",
  "ludo",
  "fourup",
];

describe("catalog: retired games", () => {
  it("keeps exactly the 29 owner-picked games live", () => {
    expect(GAMES.map((g) => g.id).sort()).toEqual([...KEEP].sort());
    expect(GAME_COUNT).toBe(29);
    expect(GAMES.every((g) => !g.retired && !g.lab)).toBe(true);
  });

  it("retires the other 32 but keeps them in code", () => {
    expect(RETIRED_IDS.size).toBe(32);
    expect(RETIRED_GAMES).toHaveLength(32);
    expect(ALL_GAMES).toHaveLength(61);
    for (const id of RETIRED_IDS) {
      expect(GAME_BY_ID[id], id).toBeDefined();
      expect(GAME_BY_ID[id].retired, id).toBe(true);
      expect(isRetired(id)).toBe(true);
      expect(playableGame(id), id).toBeUndefined();
      expect(isLiveGame(id)).toBe(false);
      expect(isLabGame(id)).toBe(false);
    }
  });

  it("promotes Trotro Jam, Emoji Hits and Beat Tap to live, and leaves the lab empty", () => {
    for (const id of ["trotro", "emojihits", "beattap"]) {
      expect(isLiveGame(id), id).toBe(true);
      expect(GAME_BY_ID[id].lab, id).toBeFalsy();
    }
    expect(LAB_GAMES).toEqual([]);
  });

  it("refuses unknown ids like retired ones", () => {
    expect(playableGame("nope")).toBeUndefined();
    expect(playableGame(null)).toBeUndefined();
    expect(playableGame("toString")).toBeUndefined();
    expect(playableGame("crownfall")?.id).toBe("crownfall");
  });

  it("hides Number Den, the only world left empty", () => {
    expect(ALL_WORLDS).toHaveLength(9);
    expect(WORLDS.map((w) => w.id)).not.toContain("number");
    expect(WORLD_COUNT).toBe(8);
    expect(isLiveWorld("number")).toBe(false);
    expect(isLiveWorld("logic")).toBe(true);
    // Lookups still resolve for old results and colours.
    expect(WORLD_BY_ID.number.name).toBe("Number Den");
    for (const w of WORLDS) expect(gamesInWorld(w.id).length, w.id).toBeGreaterThan(0);
    expect(gamesInWorld("shape").map((g) => g.id)).toEqual(["trotro"]);
    expect(gamesInWorld("clue").map((g) => g.id)).toEqual(["quickfire", "emojihits"]);
  });

  it("keeps retired games out of every derived player list", () => {
    const retired = (ids: string[]) => ids.filter((id) => isRetired(id));
    expect(retired(LAUNCH_IDS)).toEqual([]);
    expect(retired(RACE_GAMES.map((g) => g.id))).toEqual([]);
    expect(retired(PARTY_GAME_IDS)).toEqual([]);
    expect(retired(CLASSROOM_GAMES.map((g) => g.id))).toEqual([]);
    expect(retired(Object.keys(DEFAULT_META))).toEqual([]);
    expect(isRaceGame("quilt")).toBe(false);
    // The random mix never deals a retired game, even when asked for one.
    const mix = pickGames(createRng("t"), "pixl", 40, ["quilt", "sums"]);
    expect(retired(mix)).toEqual([]);
  });

  it("derives player-facing counts from the catalog", () => {
    const n = String(GAME_COUNT);
    expect(aboutCopy.eyebrow).toBe(`${GAME_COUNT} free games · ${WORLD_COUNT} worlds`);
    expect(aboutCopy.metaTitle).toContain(n);
    expect(aboutCopy.metaDescription).toContain(n);
    expect(aboutCopy.tryIt.solved).toContain(n);
    expect(aboutCopy.stats.slice(0, 2)).toEqual([
      [n, "games"],
      [String(WORLD_COUNT), "worlds"],
    ]);
    expect(aboutCopy.worldsTitle).toBe("Eight worlds to wander.");
    expect(aboutCopy.gamesCount(1)).toBe("1 game");
    expect(libraryCopy.searchPlaceholder).toBe(`Search ${GAME_COUNT} games`);
    expect(siteCopy.title).toBe(`SPUZL · ${GAME_COUNT} games, one Grid`);
    expect(siteCopy.description).toContain(`${WORLD_COUNT} worlds`);
    expect(siteCopy.howToPlayLede).toContain(`${GAME_COUNT} games in ${WORLD_COUNT} worlds`);
    expect(copy.welcome.helloBody).toContain(n);
    expect(copy.welcome.starts.pick.t).toBe(`Browse all ${GAME_COUNT} games`);
    // No stale hand-typed totals left behind.
    const all = JSON.stringify([aboutCopy, libraryCopy, siteCopy, copy.welcome]);
    expect(all).not.toMatch(/\b(51|61)\b|[Nn]ine worlds|9 worlds/);
  });
});
