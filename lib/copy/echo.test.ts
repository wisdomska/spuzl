import { describe, expect, it } from "vitest";
import { echoCopy as t } from "./echo";

describe("echoCopy", () => {
  it("keeps the board's wording", () => {
    expect(t.slipEnd(t.wrongPad, 1)).toBe("Wrong pad. You repeated 1 step.");
    expect(t.slipEnd(t.tooSlow, 4)).toBe("Too slow. You repeated 4 steps.");
    expect(t.watch(2, 3)).toBe("Watch. Round 2, 3 steps.");
    expect(t.roundDone(1)).toBe("1 step. One more next round.");
    expect(t.pad("circle", true)).toBe("circle pad, lit");
  });
});
