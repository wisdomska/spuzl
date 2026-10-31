import { describe, expect, it } from "vitest";
import { nextRoundStart, roundOutcomes } from "./duel";

describe("roundOutcomes (SPZ-03)", () => {
  const row = (round: number, playerId: string, won: boolean, place: number | null) => ({ round, playerId, won, place });
  it("adds up to the score: bot wins, a tie and my win", () => {
    const rows = [row(1, "me", false, 2), row(2, "me", false, 1), row(3, "me", true, 1)];
    const out = roundOutcomes(rows, "me", null, 3, true);
    expect(out).toEqual(["them", "draw", "me"]);
    expect(out.filter((o) => o === "me").length).toBe(1);
    expect(out.filter((o) => o === "them").length).toBe(1);
  });
  it("reads the rival's win between two players", () => {
    const rows = [row(1, "me", false, 2), row(1, "you", true, 1)];
    expect(roundOutcomes(rows, "me", "you", 1, false)).toEqual(["them"]);
  });
  it("uses the admin round result time", () => {
    expect(nextRoundStart(0, 3000)).toBe(3000 + 4000);
  });
});
