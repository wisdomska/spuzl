import { describe, expect, it } from "vitest";
import { BAY_GAMES, BAY_SEATS, bayGamesFor, loadRules } from "./bay";
import { partyBoardGames } from "./games";
import { DEFAULTS } from "@/lib/game-settings/schema";
import type { GameSwitch } from "@/lib/catalog";

/** Owner, 14 Nov 2026: a Party for 4 can pick the board games four can play. */
describe("party board games", () => {
  it("seat counts match each game's rules", async () => {
    for (const g of BAY_GAMES) expect(BAY_SEATS[g]).toEqual((await loadRules(g)).seats);
  });

  it("offers every board game for 2 and only Ludo for 3 or 4", () => {
    expect(bayGamesFor(2)).toEqual([...BAY_GAMES]);
    expect(bayGamesFor(3)).toEqual(["ludo"]);
    expect(bayGamesFor(4)).toEqual(["ludo"]);
    expect(bayGamesFor(5)).toEqual([]);
  });

  it("leaves out games that are switched off", () => {
    const s = { ...DEFAULTS, "games.off": [], "games.testing": [] } as unknown as GameSwitch;
    expect(partyBoardGames(4, s)).toEqual(["ludo"]);
    expect(partyBoardGames(4, { ...s, "games.off": ["ludo"] } as unknown as GameSwitch)).toEqual([]);
    expect(partyBoardGames(4, { ...s, "games.testing": ["ludo"] } as unknown as GameSwitch)).toEqual([]);
  });
});
