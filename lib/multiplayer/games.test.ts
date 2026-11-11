import { describe, expect, it } from "vitest";
import { DEFAULT_SWITCH, GAMES } from "@/lib/catalog";
import {
  PARTY_GAME_IDS,
  RACE_GAMES,
  SCORE_RACE_GAMES,
  challengeLinks,
  duelGames,
  isDuelGame,
  isRaceGame,
  isVersusEligible,
  partyGames,
  partyGameParam,
  pickGames,
  raceGameParam,
  roomGamesName,
} from "./games";
import { createRng } from "@/lib/rng";
import { PARTY_GAMES, PARTY_PICK_MAX } from "./constants";
import { RoomCreateInput, RoomSettingsInput } from "./roomInput";

describe("Party game picker (SPZ-13)", () => {
  it("offers every race game, not a hand-picked few", () => {
    expect(PARTY_GAME_IDS).toEqual(RACE_GAMES.map((g) => g.id));
    expect(PARTY_GAME_IDS.length).toBeGreaterThan(5);
    expect(PARTY_GAME_IDS.every(isRaceGame)).toBe(true);
  });

  it("the rooms API accepts exactly what the picker can offer (time races, and score races: R3-08)", () => {
    for (const id of PARTY_GAME_IDS) expect(RoomCreateInput.safeParse({ game: id }).success).toBe(true);
    expect(RoomCreateInput.safeParse({ game: null }).success).toBe(true);
    // Score games pass the body check; the lobby then checks "party.scoreRaces" and the lab switch (isPartyGame).
    for (const g of SCORE_RACE_GAMES) expect(RoomCreateInput.safeParse({ game: g.id }).success).toBe(true);
    const offered = new Set([...PARTY_GAME_IDS, ...SCORE_RACE_GAMES.map((g) => g.id)]);
    for (const g of GAMES.filter((x) => !offered.has(x.id))) {
      expect(RoomCreateInput.safeParse({ game: g.id }).success).toBe(false);
      expect(RoomSettingsInput.safeParse({ game: g.id }).success).toBe(false);
    }
    expect(RoomCreateInput.safeParse({ game: "nope" }).success).toBe(false);
  });

  it("reads ?game= only for race games open now", () => {
    const on = DEFAULT_SWITCH;
    expect(raceGameParam(PARTY_GAME_IDS[0], on)).toBe(PARTY_GAME_IDS[0]);
    expect(raceGameParam("chess", on)).toBeNull();
    expect(raceGameParam(null, on)).toBeNull();
    expect(raceGameParam("", on)).toBeNull();
    expect(raceGameParam(PARTY_GAME_IDS[0], { ...on, "games.off": [PARTY_GAME_IDS[0]] })).toBeNull();
  });

  it("reads a Party ?game= for score games too, while score races are on (R4-08)", () => {
    const live = SCORE_RACE_GAMES.find((g) => !g.lab)!;
    const on = { ...DEFAULT_SWITCH, "party.scoreRaces": true };
    const off = { ...on, "party.scoreRaces": false };
    expect(partyGameParam(live.id, on)).toBe(live.id);
    expect(partyGameParam(live.id, off)).toBeNull();
    expect(raceGameParam(live.id, on)).toBeNull(); // never a Duel
    expect(partyGameParam(PARTY_GAME_IDS[0], off)).toBe(PARTY_GAME_IDS[0]);
    expect(partyGameParam("chess", on)).toBeNull();
    expect(partyGameParam(null, on)).toBeNull();
    // A score game In testing is never offered (not even to an admin): Duels and Parties are for games that are On.
    expect(partyGameParam(live.id, { ...on, "games.testing": [live.id] })).toBeNull();
  });

  it("game-first links carry the game the Duel and Party screens read back", () => {
    const id = PARTY_GAME_IDS[0];
    const l = challengeLinks(id);
    const q = (href: string) => new URL(href, "http://x").searchParams;
    expect(l.quick).toBe(`/duel?game=${id}`);
    expect(raceGameParam(q(l.quick).get("game"), DEFAULT_SWITCH)).toBe(id);
    expect(q(l.friend).get("invite")).toBe("1");
    expect(raceGameParam(q(l.friend).get("game"), DEFAULT_SWITCH)).toBe(id);
    expect(new URL(l.party, "http://x").pathname).toBe("/party");
    expect(q(l.party).get("host")).toBe("1");
    expect(raceGameParam(q(l.party).get("game"), DEFAULT_SWITCH)).toBe(id);
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
      const g = pickGames(createRng(`party:room:${set}`), null, PARTY_GAMES, picks, isRaceGame);
      expect(g).toHaveLength(PARTY_GAMES);
      expect(new Set(g).size).toBe(PARTY_GAMES);
      expect(g.every((x) => picks.includes(x))).toBe(true);
      expect(pickGames(createRng(`party:room:${set}`), null, PARTY_GAMES, picks, isRaceGame)).toEqual(g);
    }
    // two picks fill three rounds by taking turns
    const two = pickGames(createRng("party:two"), null, PARTY_GAMES, picks.slice(0, 2), isRaceGame);
    expect(new Set(two)).toEqual(new Set(picks.slice(0, 2)));
    // one chosen game still wins
    expect(pickGames(createRng("x"), picks[0], PARTY_GAMES, [], isRaceGame)).toEqual([picks[0], picks[0], picks[0]]);
  });

  it("follows the Games page: a game Off, In testing or kept out of Duels and Parties never races", () => {
    const [a, b] = PARTY_GAME_IDS;
    const s = { ...DEFAULT_SWITCH, "party.scoreRaces": true };
    expect(isDuelGame(a, s)).toBe(true);
    for (const key of ["games.off", "games.testing", "games.noVersus"] as const) {
      const closed = { ...s, [key]: [a] };
      expect(isDuelGame(a, closed), key).toBe(false);
      expect(
        duelGames(closed).map((g) => g.id),
        key,
      ).not.toContain(a);
      expect(
        partyGames(closed).map((g) => g.id),
        key,
      ).not.toContain(a);
      // A Random mix and a hand-picked list skip it too.
      const mix = pickGames(createRng(`mix:${key}`), null, 12, [a, b], (id) => isDuelGame(id, closed));
      expect(
        mix.every((g) => g === b),
        key,
      ).toBe(true);
      expect(pickGames(createRng("chosen"), a, 3, undefined, (id) => isDuelGame(id, closed)).includes(a), key).toBe(false);
    }
    // Nothing left to race: no rounds at all, and the server refuses the room.
    const none = { ...s, "games.off": RACE_GAMES.map((g) => g.id) };
    expect(pickGames(createRng("none"), null, 3, undefined, (id) => isDuelGame(id, none))).toEqual([]);
  });

  it("offers the Duels and Parties switch only for games that can be raced", () => {
    for (const id of PARTY_GAME_IDS) expect(isVersusEligible(id), id).toBe(true);
    for (const g of SCORE_RACE_GAMES) expect(isVersusEligible(g.id), g.id).toBe(true);
    expect(isVersusEligible("chess")).toBe(false);
    expect(isVersusEligible("dash")).toBe(false);
  });

  it("names a room by its picks, its game or Random mix", () => {
    const [a, b] = RACE_GAMES;
    expect(roomGamesName(null, [a.id, b.id])).toBe(`${a.name}, ${b.name}`);
    expect(roomGamesName(a.id, [])).toBe(a.name);
    expect(roomGamesName(null, [])).toBe("Random mix");
  });
});
