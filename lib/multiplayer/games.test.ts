import { describe, expect, it } from "vitest";
import { GAMES } from "@/lib/catalog";
import { PARTY_GAME_IDS, RACE_GAMES, isRaceGame, raceGameParam } from "./games";
import { RoomCreateInput, RoomSettingsInput } from "./roomInput";

describe("Party game picker (SPZ-13)", () => {
  it("offers every race game, not a hand-picked few", () => {
    expect(PARTY_GAME_IDS).toEqual(RACE_GAMES.map((g) => g.id));
    expect(PARTY_GAME_IDS.length).toBeGreaterThan(5);
    expect(PARTY_GAME_IDS.every(isRaceGame)).toBe(true);
  });

  it("the rooms API accepts exactly what the picker offers", () => {
    for (const id of PARTY_GAME_IDS) expect(RoomCreateInput.safeParse({ game: id }).success).toBe(true);
    expect(RoomCreateInput.safeParse({ game: null }).success).toBe(true);
    const offered = new Set(PARTY_GAME_IDS);
    for (const g of GAMES.filter((x) => !offered.has(x.id))) {
      expect(RoomCreateInput.safeParse({ game: g.id }).success).toBe(false);
      expect(RoomSettingsInput.safeParse({ game: g.id }).success).toBe(false);
    }
    expect(RoomCreateInput.safeParse({ game: "nope" }).success).toBe(false);
  });

  it("reads ?game= only for race games", () => {
    expect(raceGameParam(PARTY_GAME_IDS[0])).toBe(PARTY_GAME_IDS[0]);
    expect(raceGameParam("chess")).toBeNull();
    expect(raceGameParam(null)).toBeNull();
    expect(raceGameParam("")).toBeNull();
  });
});
