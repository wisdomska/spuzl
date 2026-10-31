import { describe, expect, it } from "vitest";
import { timedScore } from "@/games/_shared/cluecave";
import { quick } from "./quick";

describe("quick copy: quiz summary", () => {
  it("reads like the design: right of total, then points", () => {
    expect(quick.quiz.summary(4, 5, 469)).toBe("4 of 5 · 469 pts");
    expect(quick.quiz.summary(10, 10, 1500)).toBe("10 of 10 · 1,500 pts");
  });

  it("summarises a run with a wrong answer and a timeout from the scored answers", () => {
    const answers = [
      { pick: 0, ms: 3000 },
      { pick: 1, ms: 4000 },
      { pick: null, ms: 15000 },
      { pick: 2, ms: 6000 },
      { pick: 3, ms: 9000 },
    ];
    const { right, score } = timedScore(answers, [0, 2, 1, 2, 3], 15000);
    expect(quick.quiz.summary(right, 5, score)).toBe(`3 of 5 · ${score} pts`);
    expect(quick.quiz.summarySay(right, 5, score)).toContain("3 of 5 right");
  });
});

describe("quick copy: quads", () => {
  it("names all four difficulty levels, each different", () => {
    expect(quick.quads.levels).toHaveLength(4);
    expect(new Set(quick.quads.levels).size).toBe(4);
  });

  it("says one away and how many slips are left in one message", () => {
    expect(quick.quads.oneAway(2)).toBe("One away. 2 slips left.");
    expect(quick.quads.notGroup(1)).toBe("Not a group. 1 slip left.");
  });

  it("announces a found group with its name, level and words", () => {
    expect(quick.quads.foundSay("Ghana regions", "Easy", ["ASHANTI", "VOLTA", "NORTHERN", "CENTRAL"], 1)).toBe(
      "Group found: Ghana regions, Easy: ASHANTI, VOLTA, NORTHERN, CENTRAL. 1 of 4 groups.",
    );
    expect(quick.quads.found("Ghana regions", "Easy", 4)).toBe("Ghana regions (Easy). All four groups.");
  });
});
