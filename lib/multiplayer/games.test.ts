import { describe, expect, it } from "vitest";
import { GAMES } from "@/lib/catalog";
import { PARTY_GAME_IDS, RACE_GAMES, challengeLinks, isRaceGame, pickGames, raceGameParam, roomGamesName } from "./games";
import { createRng } from "@/lib/rng";
import { PARTY_GAMES, PARTY_PICK_MAX } from "./constants";
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

  it("takes a hand-picked list of 2 to 8 different race games", () => {
    const [a, b, c] = PARTY_GAME_IDS;
    expect(RoomCreateInput.parse({ games: [a, b] }).games).toEqual([a, b]);
    expect(RoomCreateInput.parse({}).games).toBeNull();
    expect(RoomSettingsInput.safeParse({ games: [a, b, c] }).success).toBe(true);
    expect(RoomSettingsInput.safeParse({ games: null }).success).toBe(true);
    expect(RoomCreateInput.safeParse({ games: [a] }).success).toBe(false);
    expect(RoomCreateInput.safeParse({ games: [a, a] }).success).toBe(false);
    expect(RoomCreateInput.safeParse({ games: [a, "chess"] }).success).toBe(false);
    expect(RoomCreateInput.safeParse({ games: PARTY_GAME_IDS.slice(0, PARTY_PICK_MAX + 1) }).success).toBe(false);
  });

  it("races only the picked games, a seeded shuffle per set", () => {
    const picks = PARTY_GAME_IDS.slice(0, 5);
    for (const set of [1, 2, 3, 4]) {
      const g = pickGames(createRng(`party:room:${set}`), null, PARTY_GAMES, picks);
      expect(g).toHaveLength(PARTY_GAMES);
      expect(new Set(g).size).toBe(PARTY_GAMES);
      expect(g.every((x) => picks.includes(x))).toBe(true);
      expect(pickGames(createRng(`party:room:${set}`), null, PARTY_GAMES, picks)).toEqual(g);
    }
    // two picks fill three rounds by taking turns
    const two = pickGames(createRng("party:two"), null, PARTY_GAMES, picks.slice(0, 2));
    expect(new Set(two)).toEqual(new Set(picks.slice(0, 2)));
    // one chosen game still wins
    expect(pickGames(createRng("x"), picks[0], PARTY_GAMES, [])).toEqual([picks[0], picks[0], picks[0]]);
  });

  it("names a room by its picks, its game or Random mix", () => {
    const [a, b] = RACE_GAMES;
    expect(roomGamesName(null, [a.id, b.id])).toBe(`${a.name}, ${b.name}`);
    expect(roomGamesName(a.id, [])).toBe(a.name);
    expect(roomGamesName(null, [])).toBe("Random mix");
  });
});
