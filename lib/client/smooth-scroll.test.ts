import { describe, expect, it } from "vitest";
import { easeInOut, glideMs } from "./smooth-scroll";

describe("same-page glide", () => {
  it("is quick: 250 ms for short hops, at most 500 ms", () => {
    expect(glideMs(100)).toBe(250);
    expect(glideMs(-1800)).toBe(360);
    expect(glideMs(20_000)).toBe(500);
  });
  it("eases in and out, from 0 to 1", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
  });
});
