import { describe, expect, it } from "vitest";
import { GAMES } from "@/lib/catalog";
import { PARTY_GAME_IDS, RACE_GAMES, challengeLinks, isRaceGame, raceGameParam } from "./games";
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

  it("game-first links carry the game the Duel and Party screens read back", () => {
    const id = PARTY_GAME_IDS[0];
    const l = challengeLinks(id);
    const q = (href: string) => new URL(href, "http://x").searchParams;
    expect(l.quick).toBe(`/duel?game=${id}`);
    expect(raceGameParam(q(l.quick).get("game"))).toBe(id);
    expect(q(l.friend).get("invite")).toBe("1");
    expect(raceGameParam(q(l.friend).get("game"))).toBe(id);
    expect(new URL(l.party, "http://x").pathname).toBe("/party");
    expect(q(l.party).get("host")).toBe("1");
    expect(raceGameParam(q(l.party).get("game"))).toBe(id);
  });
});
