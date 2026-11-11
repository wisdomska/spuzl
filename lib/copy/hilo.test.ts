import { describe, expect, it } from "vitest";
import { hilo } from "./hilo";

describe("hilo copy", () => {
  it("says a sum's worth and never repeats a plain card", () => {
    expect(hilo.right("5 × 2", 10, "lower", 31)).toBe("Right. 5 × 2 is 10, lower than 31.");
    expect(hilo.right("10", 10, "lower", 31)).toBe("Right. 10 is lower than 31.");
    expect(hilo.slip("44", 44, "higher", 31, 2)).toBe("Slip. 44 is higher than 31. 2 slips left.");
    expect(hilo.slip("6 + 7", 13, "lower", 31, 1)).toBe("Slip. 6 + 7 is 13, lower than 31. 1 slip left.");
    expect(hilo.anchorCard("31", 31)).toBe("Now showing 31");
    expect(hilo.anchorCard("5 × 2", 10)).toBe("Now showing 5 × 2, worth 10");
  });
});
