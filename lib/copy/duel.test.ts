import { describe, expect, it } from "vitest";
import { duelCopy } from "./duel";

describe("duelCopy.roundLine", () => {
  it("names the margin to a tenth when both times are in", () => {
    expect(duelCopy.roundLine("me", 1.24)).toBe("You won by 1.2 seconds. They felt it.");
    expect(duelCopy.roundLine("them", 0.46)).toBe("You lost by 0.5 seconds. Next board is yours.");
  });
  it("never promises a rematch between rounds", () => {
    for (const who of ["me", "them", "draw"] as const)
      for (const m of [null, 2]) expect(duelCopy.roundLine(who, m)).not.toMatch(/rematch/i);
  });
});
