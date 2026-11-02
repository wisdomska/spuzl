import { describe, expect, it } from "vitest";
import { DEFAULTS } from "@/lib/game-settings/schema";
import { ADULT_REWARD_MIN_PLAYERS, adultRewardRef, adultRewards, playedIn, type AdultEconomy } from "./rewards";

const eco: AdultEconomy = { xpPerRound: 5, sparksPerRound: 1, winXp: 20, winSparks: 5, xpDailyCap: 150 };
const lineUp = ["a", "b", "c", "d"];

describe("18+ party rewards: who played a round", () => {
  it("counts the drawer only when they drew, and everyone who guessed", () => {
    expect(playedIn({ leadId: "a", mode: "draw", strokes: 3, wrote: false, acted: ["b", "c"], lineUp })).toEqual(["a", "b", "c"]);
    expect(playedIn({ leadId: "a", mode: "draw", strokes: 0, wrote: false, acted: ["b"], lineUp })).toEqual(["b"]);
  });

  it("counts the writer only when they wrote, and everyone who voted", () => {
    expect(playedIn({ leadId: "a", mode: "truths", strokes: 0, wrote: true, acted: ["d"], lineUp })).toEqual(["a", "d"]);
    expect(playedIn({ leadId: "a", mode: "truths", strokes: 0, wrote: false, acted: [], lineUp })).toEqual([]);
  });

  it("never counts anyone twice or outside the line-up", () => {
    expect(playedIn({ leadId: "a", mode: "draw", strokes: 1, wrote: false, acted: ["b", "b", "a", "zz"], lineUp })).toEqual(["a", "b"]);
  });
});

describe("18+ party rewards: what each finisher is owed", () => {
  const room = [
    { id: "a", rounds: 4, place: 1 },
    { id: "b", rounds: 3, place: 2 },
    { id: "c", rounds: 0, place: 3 },
  ];

  it("pays per round played plus the winner bonus", () => {
    expect(adultRewards(room, eco)).toEqual([
      { id: "a", won: true, xp: 4 * 5 + 20, sparks: 4 + 5 },
      { id: "b", won: false, xp: 15, sparks: 3 },
    ]);
  });

  it("pays nothing in rooms with fewer than three finishers", () => {
    expect(ADULT_REWARD_MIN_PLAYERS).toBe(3);
    expect(adultRewards(room.slice(0, 2), eco)).toEqual([]);
  });

  it("pays an idle player nothing, even when tied for first", () => {
    const idle = [
      { id: "a", rounds: 0, place: 1 },
      { id: "b", rounds: 0, place: 1 },
      { id: "c", rounds: 2, place: 1 },
    ];
    expect(adultRewards(idle, eco)).toEqual([{ id: "c", won: true, xp: 30, sparks: 7 }]);
  });

  it("shares the winner bonus on a tie for first", () => {
    const tie = [
      { id: "a", rounds: 1, place: 1 },
      { id: "b", rounds: 1, place: 1 },
      { id: "c", rounds: 1, place: 3 },
    ];
    expect(
      adultRewards(tie, eco)
        .filter((r) => r.won)
        .map((r) => r.id),
    ).toEqual(["a", "b"]);
  });

  it("follows the admin amounts, and zero amounts pay nothing", () => {
    const zero = { ...eco, xpPerRound: 0, sparksPerRound: 0, winXp: 0, winSparks: 0 };
    expect(adultRewards(room, zero)).toEqual([]);
    expect(adultRewards(room, { ...eco, xpPerRound: 10, sparksPerRound: 0 })[1]).toEqual({ id: "b", won: false, xp: 30, sparks: 0 });
  });

  it("matches the settings defaults and refs one room set", () => {
    expect(DEFAULTS["adultParty.xpPerRound"]).toBe(5);
    expect(DEFAULTS["adultParty.sparksPerRound"]).toBe(1);
    expect(DEFAULTS["adultParty.winXp"]).toBe(20);
    expect(DEFAULTS["adultParty.winSparks"]).toBe(5);
    expect(DEFAULTS["adultParty.xpDailyCap"]).toBe(150);
    expect(adultRewardRef("m1", 2)).toBe("m1:2");
  });
});
