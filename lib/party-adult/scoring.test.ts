import { describe, expect, it } from "vitest";
import { addAwards, checkGuess, drawAwards, guesserPoints, placesOf, truthsAwards, wordShape } from "./scoring";

describe("Draw It scoring", () => {
  it("pays guessers by speed, 200 down to 50", () => {
    expect(guesserPoints(0, 80_000)).toBe(200);
    expect(guesserPoints(40_000, 80_000)).toBe(125);
    expect(guesserPoints(80_000, 80_000)).toBe(50);
    expect(guesserPoints(99_000, 80_000)).toBe(50);
    expect(guesserPoints(-5, 80_000)).toBe(200);
  });
  it("pays the drawer 50 per correct guesser and counts each guesser once", () => {
    const a = drawAwards(
      "d",
      [
        { playerId: "a", elapsedMs: 0 },
        { playerId: "b", elapsedMs: 40_000 },
        { playerId: "a", elapsedMs: 50_000 },
        { playerId: "d", elapsedMs: 1 },
      ],
      80_000,
    );
    expect(a).toEqual({ a: 200, b: 125, d: 100 });
  });
  it("gives the drawer nothing when nobody gets it", () => {
    expect(drawAwards("d", [], 80_000)).toEqual({});
  });
});

describe("Two Truths scoring", () => {
  it("pays 100 for spotting the lie and the writer 50 per player fooled", () => {
    const votes = [
      { playerId: "a", pick: 2 },
      { playerId: "b", pick: 0 },
      { playerId: "c", pick: 1 },
    ];
    expect(truthsAwards("w", 2, votes)).toEqual({ a: 100, w: 100 });
  });
  it("ignores a writer's own vote and pays nothing when everyone spots it", () => {
    expect(
      truthsAwards("w", 0, [
        { playerId: "w", pick: 1 },
        { playerId: "a", pick: 0 },
      ]),
    ).toEqual({ a: 100 });
  });
});

describe("totals and places", () => {
  it("adds awards and shares places on a tie", () => {
    const t = addAwards({ a: 100, b: 50 }, { b: 50, c: 10 });
    expect(t).toEqual({ a: 100, b: 100, c: 10 });
    expect(placesOf(t)).toEqual([
      { id: "a", points: 100, place: 1 },
      { id: "b", points: 100, place: 1 },
      { id: "c", points: 10, place: 3 },
    ]);
  });
});

describe("guess checking", () => {
  const w = { word: "fan ice", alt: ["ice cream"] };
  it("accepts the word and its alternates, ignoring case, spaces and punctuation", () => {
    expect(checkGuess("Fan-Ice!", w)).toBe("correct");
    expect(checkGuess("FANICE", w)).toBe("correct");
    expect(checkGuess("ice cream", w)).toBe("correct");
    expect(checkGuess("trotro", { word: "trotro", alt: ["tro tro"] })).toBe("correct");
    expect(checkGuess("tro tro", { word: "trotro" })).toBe("correct");
  });
  it("marks guesses that give the word away as close, others wrong", () => {
    expect(checkGuess("cold fan ice", w)).toBe("close");
    expect(checkGuess("kente cloth", { word: "kente" })).toBe("close");
    expect(checkGuess("ice", w)).toBe("wrong");
    expect(checkGuess("", w)).toBe("wrong");
  });
  it("shapes the blanks by word", () => {
    expect(wordShape("talking drum")).toEqual([7, 4]);
  });
});
