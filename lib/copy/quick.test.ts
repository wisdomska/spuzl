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
