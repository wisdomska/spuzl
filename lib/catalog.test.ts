import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
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
  NEW_GAMES,
  NEW_IDS,
  isNewGame,
  DEFAULT_SWITCH,
  gameState,
  openGame,
  playableGame,
  playerGames,
  playerGamesInWorld,
  playerWorlds,
  versusAllowed,
  colourOf,
  toneOf,
  type WorldId,
} from "./catalog";
import { ICONS } from "@/components/ui/icons.generated";
import { RACE_GAMES, PARTY_GAME_IDS, isRaceGame, pickGames } from "./multiplayer/games";
import { DEFAULT_META } from "./games-meta";
import { aboutCopy } from "./copy/about";
import { libraryCopy } from "./copy/library";
import { siteCopy } from "./copy/site";
import { copy } from "./copy";
import { createRng } from "./rng";

/** The 29 owner-picked games live since the 2026-11 cut (28, plus Quads back in R2-14). */
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
  "quads",
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
  "chess",
  "draughts",
  "oware",
  "ludo",
  "fourup",
];

/** The eleven R2-P5 brought back from retirement as lab games, then Two Truths and a Lie (R2-P5 part B). */
const BACK = ["five", "hilo", "penalty", "market", "lightup", "killer", "dara", "pinned", "flagged", "tripwire", "pixl"];
const GRADUATED = [...BACK, "twotruths"];
/** Retired by the owner on 14 Nov 2026 (Twins was cut the same day and then came back as a growing grid). */
const CUTS = ["beattap", "penalty", "hilo", "killer", "lightup", "pixl", "market", "pinned"];
const LIVE = [...KEEP, ...GRADUATED].filter((id) => !CUTS.includes(id));

describe("Graduate: the twelve lab games are live (11 Nov 2026)", () => {
  it("makes all twelve live, none lab, none retired, each in its own world", () => {
    for (const id of GRADUATED.filter((g) => !CUTS.includes(g))) {
      expect(isLiveGame(id), id).toBe(true);
      expect(isLabGame(id), id).toBe(false);
      expect(isRetired(id), id).toBe(false);
      expect(GAME_BY_ID[id].lab, id).toBeFalsy();
      expect(
        GAMES.map((g) => g.id),
        id,
      ).toContain(id);
    }
    const world = Object.fromEntries(GRADUATED.map((id) => [id, GAME_BY_ID[id].world]));
    expect(world).toEqual({
      five: "word",
      pinned: "word",
      flagged: "word",
      twotruths: "word",
      hilo: "logic",
      market: "logic",
      lightup: "logic",
      killer: "logic",
      tripwire: "logic",
      pixl: "logic",
      penalty: "reflex",
      dara: "board",
    });
    expect(GAME_BY_ID.twotruths).toMatchObject({ world: "word", scoring: "score", content: "curated" });
  });

  it("leaves no game in testing", () => {
    expect(LAB_GAMES).toEqual([]);
    expect(ALL_GAMES.filter((g) => g.lab)).toEqual([]);
    expect(GAME_COUNT).toBe(32);
  });
});

describe("catalog: retired games", () => {
  it("keeps the owner-picked and graduated games live, less the owner's cuts of 14 Nov 2026: 32 (Spuzdoku's 9 × 9 is not counted on its own)", () => {
    expect(GAMES.map((g) => g.id).sort()).toEqual([...LIVE].sort());
    expect(GAME_COUNT).toBe(32);
    expect(GAMES.every((g) => !g.retired && !g.lab)).toBe(true);
  });

  it("retires 29 games but keeps them in code (21, plus the owner's eight cuts of 14 Nov 2026)", () => {
    expect(RETIRED_IDS.size).toBe(29);
    expect(RETIRED_GAMES).toHaveLength(29);
    // 61 before R2-P5 part B, plus Two Truths and a Lie
    expect(ALL_GAMES).toHaveLength(62);
    for (const id of RETIRED_IDS) {
      expect(GAME_BY_ID[id], id).toBeDefined();
      expect(GAME_BY_ID[id].retired, id).toBe(true);
      expect(isRetired(id)).toBe(true);
      expect(playableGame(id), id).toBeUndefined();
      expect(isLiveGame(id)).toBe(false);
      expect(isLabGame(id)).toBe(false);
    }
  });

  it("promotes Trotro Jam and Emoji Hits to live (Beat Tap was live, then retired 14 Nov 2026)", () => {
    for (const id of ["trotro", "emojihits"]) {
      expect(isLiveGame(id), id).toBe(true);
      expect(GAME_BY_ID[id].lab, id).toBeFalsy();
    }
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
    ["logic", "Puzzles", ["crownfall", "dusk", "sixer", "nine", "tripwire", "weave", "flowline", "pairup", "lost", "trotro"]],
    [
      "word",
      "Words & Quiz",
      ["coil", "rungs", "quads", "seven", "minicross", "buried", "remix", "five", "quickfire", "emojihits", "flagged", "twotruths"],
    ],
    ["reflex", "Arcade", ["gotcha", "echo", "flinch", "dash", "twins"]],
    ["board", "Board Games", ["chess", "draughts", "oware", "ludo", "fourup", "dara"]],
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
    expect(seen).toHaveLength(GAME_COUNT + 1); // gamesInWorld keeps Spuzdoku's 9 × 9 (admin and static paths)
    expect(new Set(seen).size).toBe(GAME_COUNT + 1);
    expect([...seen].sort()).toEqual(GAMES.map((g) => g.id).sort());
    for (const g of GAMES) expect(isLiveWorld(g.world), g.id).toBe(true);
  });

  it("gives each group a tagline, a registered icon and a world colour token", () => {
    for (const w of WORLDS) {
      expect(w.tagline, w.id).toMatch(/^[A-Z][^.]+$/);
      expect(ICONS[w.icon], w.icon).toBeDefined();
      expect(w.color).toMatch(/^var\(--w-[a-z]+\)$/);
      expect(w.ink).toBe(w.color.replace(")", "-ink)"));
    }
    expect(new Set(WORLDS.map((w) => w.icon)).size).toBe(WORLDS.length);
    // Every group has its own colour: Puzzles blue, Words green, Arcade red, Board Games brown.
    expect(WORLDS.map((w) => [w.id, w.color])).toEqual([
      ["logic", "var(--w-reflex)"],
      ["word", "var(--w-word)"],
      ["reflex", "var(--w-rage)"],
      ["board", "var(--w-board)"],
    ]);
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

  it("gives every game in a world that world's colour", () => {
    for (const g of GAMES) {
      expect(toneOf(g), g.id).toBe(g.world);
      expect(colourOf(g).color, g.id).toBe(WORLD_BY_ID[g.world].color);
    }
    expect(toneOf(GAME_BY_ID.flowline)).toBe("logic");
    expect(toneOf(GAME_BY_ID.gotcha)).toBe("reflex");
    expect(colourOf(GAME_BY_ID.chess)).toEqual({ color: WORLD_BY_ID.board.color, ink: WORLD_BY_ID.board.ink });
  });
});

describe("Game state: On, In testing, Off (Games page)", () => {
  const sw = (testing: string[] = [], off: string[] = [], noVersus: string[] = []) => ({
    "games.testing": testing,
    "games.off": off,
    "games.noVersus": noVersus,
  });

  it("starts every game On (none in testing now that the lab is empty)", () => {
    expect(DEFAULT_SWITCH).toEqual(sw());
    for (const g of GAMES) expect(gameState(g.id, DEFAULT_SWITCH), g.id).toBe("on");
    expect(playerGames(DEFAULT_SWITCH)).toEqual(GAMES.filter((g) => !g.variantOf));
    expect(playerWorlds(DEFAULT_SWITCH)).toEqual(WORLDS);
    expect(WORLD_COUNT).toBe(4);
  });

  it("opens a game In testing for admins only, and a game Off for nobody", () => {
    const s = sw(["flagged"], ["crownfall"]);
    expect(gameState("flagged", s)).toBe("testing");
    expect(gameState("crownfall", s)).toBe("off");
    expect(openGame("flagged", s)).toBeUndefined();
    expect(openGame("flagged", s, { admin: false })).toBeUndefined();
    expect(openGame("flagged", s, { admin: true })?.id).toBe("flagged");
    expect(openGame("crownfall", s)).toBeUndefined();
    expect(openGame("crownfall", s, { admin: true })).toBeUndefined();
    expect(openGame("dusk", s)?.id).toBe("dusk");
  });

  it("never opens a retired or unknown id, whatever the switch says", () => {
    const s = sw([], [], []);
    expect(gameState("blackout", s)).toBeUndefined();
    expect(openGame("blackout", s, { admin: true })).toBeUndefined();
    expect(openGame("nope", sw(["nope"]), { admin: true })).toBeUndefined();
    expect(openGame(null, s)).toBeUndefined();
  });

  it("Off wins when a game is somehow listed both ways", () => {
    expect(gameState("dara", sw(["dara"], ["dara"]))).toBe("off");
    expect(openGame("dara", sw(["dara"], ["dara"]), { admin: true })).toBeUndefined();
  });

  it("drops games In testing and Off from every player list and count", () => {
    const s = sw(["flagged"], ["crownfall"]);
    const ids = playerGames(s).map((g) => g.id);
    expect(ids).not.toContain("flagged");
    expect(ids).not.toContain("crownfall");
    expect(ids).toHaveLength(GAME_COUNT - 2);
    expect(playerGamesInWorld("logic", s).map((g) => g.id)).not.toContain("crownfall");
    expect(playerGamesInWorld("word", s).map((g) => g.id)).not.toContain("flagged");
    // An admin's view keeps the game in testing, never the one Off.
    expect(playerGames(s, { admin: true }).map((g) => g.id)).toContain("flagged");
    expect(playerGames(s, { admin: true }).map((g) => g.id)).not.toContain("crownfall");
  });

  it("hides a world once none of its games is On", () => {
    const board = gamesInWorld("board").map((g) => g.id);
    const s = sw([], board);
    expect(playerWorlds(s).map((w) => w.id)).not.toContain("board");
    expect(playerWorlds(s)).toHaveLength(WORLDS.length - 1);
    expect(playerGamesInWorld("board", s)).toEqual([]);
  });

  it("keeps a game out of Duels and Parties only when the admin says so", () => {
    expect(versusAllowed("sixer", sw())).toBe(true);
    expect(versusAllowed("sixer", sw([], [], ["sixer"]))).toBe(false);
  });

  it("races the graduated time games in Duels and Parties, never Dara (a board game) nor the score games", () => {
    for (const id of ["five", "tripwire"]) {
      expect(isRaceGame(id), id).toBe(true);
      expect(PARTY_GAME_IDS, id).toContain(id);
    }
    for (const id of ["dara", "flagged", "twotruths"]) {
      expect(isRaceGame(id), id).toBe(false);
      expect(PARTY_GAME_IDS, id).not.toContain(id);
    }
    // None is a launch (phase L) game, so "Today x of N" keeps its launch Dailies.
    for (const id of GRADUATED) expect(LAUNCH_IDS, id).not.toContain(id);
  });
});

describe("catalog: new games (R2-14, for the R2-18 Home banner)", () => {
  it("marks Quads new and live, and only live or lab games count", () => {
    expect(NEW_IDS.has("quads")).toBe(true);
    expect(GAME_BY_ID.quads.isNew).toBe(true);
    expect(isNewGame("quads")).toBe(true);
    expect(isLiveGame("quads")).toBe(true);
    expect(NEW_GAMES.map((g) => g.id)).toContain("quads");
    for (const g of NEW_GAMES) expect(isRetired(g.id), g.id).toBe(false);
    expect(GAME_BY_ID.crownfall.isNew).toBeFalsy();
    expect(isNewGame("pixl")).toBe(false);
  });
});

describe("catalog: derived lists", () => {
  it("keeps retired games out of every derived player list", () => {
    const retired = (ids: string[]) => ids.filter((id) => isRetired(id));
    expect(retired(LAUNCH_IDS)).toEqual([]);
    expect(retired(RACE_GAMES.map((g) => g.id))).toEqual([]);
    expect(retired(PARTY_GAME_IDS)).toEqual([]);
    expect(retired(Object.keys(DEFAULT_META))).toEqual([]);
    expect(isRaceGame("quilt")).toBe(false);
    // The random mix never deals a retired game, even when asked for one.
    const mix = pickGames(createRng("t"), "pixl", 40, ["quilt", "sums"], isRaceGame);
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

describe("catalog: game art (R2-12)", () => {
  it("gives every live game a registered Phosphor icon and both 3D tiles", () => {
    for (const g of [...GAMES, ...LAB_GAMES]) {
      expect(ICONS[g.icon], `${g.id}: ${g.icon}`).toMatch(/<path /);
      for (const dir of ["icons", "icons-sm"]) expect(existsSync(`public/3d/${dir}/${g.id}.webp`), `${dir}/${g.id}.webp`).toBe(true);
    }
    // The audit's empty card icon: Emoji Hits draws a smiley, which the icon set has.
    expect(GAME_BY_ID.emojihits.icon).toBe("smiley");
  });
});

describe("R2-06: visible one-line rules", () => {
  it("every playable game has a one-line rule that fits two lines under the title on a 375 px phone", () => {
    for (const g of [...GAMES, ...LAB_GAMES]) {
      expect(g.rule.trim(), g.id).not.toBe("");
      expect(g.rule, g.id).not.toMatch(/\n/);
      // about 45 characters a line at 14 px across a 343 px column; Ludo's 122 is the longest today
      expect(g.rule.length, g.id).toBeLessThanOrEqual(130);
    }
  });
});
