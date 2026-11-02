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
  MERGED_WORLDS,
  playableGame,
  colourOf,
  toneOf,
  type WorldId,
} from "./catalog";
import { ICONS } from "@/components/ui/icons.generated";
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

  it("hides the worlds left with only retired games", () => {
    expect(ALL_WORLDS).toHaveLength(9);
    expect(WORLD_COUNT).toBe(4);
    for (const id of ["line", "shape", "number", "clue", "rage"]) {
      expect(isLiveWorld(id), id).toBe(false);
      // Lookups still resolve for old results, colours and earned badges.
      expect(WORLD_BY_ID[id as WorldId].name, id).toBeTruthy();
    }
    expect(WORLD_BY_ID.number.name).toBe("Number Den");
    for (const w of WORLDS) expect(gamesInWorld(w.id).length, w.id).toBeGreaterThan(0);
  });
});

describe("catalog: four groups", () => {
  const GROUPS: [WorldId, string, string[]][] = [
    ["logic", "Puzzles", ["crownfall", "dusk", "sixer", "nine", "weave", "flowline", "pairup", "lost", "trotro"]],
    ["word", "Words & Quiz", ["coil", "rungs", "seven", "minicross", "buried", "remix", "quickfire", "emojihits"]],
    ["reflex", "Arcade", ["echo", "twins", "flinch", "beattap", "gotcha", "dash", "gauntlet"]],
    ["board", "Board Games", ["chess", "draughts", "oware", "ludo", "fourup"]],
  ];

  it("shows exactly the 4 groups, in Home map order, with their games in order", () => {
    expect(WORLDS.map((w) => [w.id, w.name])).toEqual(GROUPS.map(([id, name]) => [id, name]));
    for (const [id, , games] of GROUPS)
      expect(
        gamesInWorld(id).map((g) => g.id),
        id,
      ).toEqual(games);
  });

  it("puts every live game in exactly one group", () => {
    const seen = WORLDS.flatMap((w) => gamesInWorld(w.id).map((g) => g.id));
    expect(seen).toHaveLength(GAME_COUNT);
    expect(new Set(seen).size).toBe(GAME_COUNT);
    expect([...seen].sort()).toEqual(GAMES.map((g) => g.id).sort());
    for (const g of GAMES) expect(isLiveWorld(g.world), g.id).toBe(true);
  });

  it("gives each group a tagline, a registered icon and a world colour token", () => {
    for (const w of WORLDS) {
      expect(w.tagline, w.id).toMatch(/^[A-Z][^.]+$/);
      expect(ICONS[w.icon], w.icon).toBeDefined();
      expect(w.color).toBe(`var(--w-${w.id})`);
      expect(w.ink).toBe(`var(--w-${w.id}-ink)`);
    }
    expect(new Set(WORLDS.map((w) => w.icon)).size).toBe(WORLDS.length);
  });

  it("sends the folded worlds to the group that took their games", () => {
    for (const [from, to] of Object.entries(MERGED_WORLDS)) {
      expect(isLiveWorld(from), from).toBe(false);
      expect(isLiveWorld(to), to).toBe(true);
    }
    for (const id of RETIRED_IDS) {
      const merged = MERGED_WORLDS[GAME_BY_ID[id].world];
      if (merged) expect(isLiveWorld(merged)).toBe(true);
    }
  });

  it("lets moved games keep the colour they were designed in", () => {
    expect(toneOf(GAME_BY_ID.flowline)).toBe("line");
    expect(toneOf(GAME_BY_ID.trotro)).toBe("shape");
    expect(toneOf(GAME_BY_ID.quickfire)).toBe("clue");
    expect(toneOf(GAME_BY_ID.gotcha)).toBe("rage");
    expect(colourOf(GAME_BY_ID.gauntlet).color).toBe("var(--w-rage)");
    // Games that did not move wear their world.
    expect(toneOf(GAME_BY_ID.crownfall)).toBe("logic");
    expect(colourOf(GAME_BY_ID.chess)).toEqual({ color: WORLD_BY_ID.board.color, ink: WORLD_BY_ID.board.ink });
  });
});

describe("catalog: derived lists", () => {
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
    expect(aboutCopy.worldsTitle).toBe("Four worlds to wander.");
    expect(aboutCopy.gamesCount(1)).toBe("1 game");
    expect(libraryCopy.searchPlaceholder).toBe(`Search ${GAME_COUNT} games`);
    expect(siteCopy.title).toBe(`SPUZL · ${GAME_COUNT} games, one Grid`);
    expect(siteCopy.description).toContain(`${WORLD_COUNT} worlds`);
    expect(siteCopy.howToPlayLede).toContain(`${GAME_COUNT} games in ${WORLD_COUNT} worlds`);
    expect(copy.welcome.helloBody).toContain(n);
    expect(copy.welcome.starts.pick.t).toBe(`Browse all ${GAME_COUNT} games`);
    // No stale hand-typed totals left behind.
    const all = JSON.stringify([aboutCopy, libraryCopy, siteCopy, copy.welcome]);
    expect(all).not.toMatch(/\b(51|61)\b|[Nn]ine worlds|9 worlds|[Ee]ight worlds|8 worlds/);
  });
});
