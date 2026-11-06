import { describe, expect, it } from "vitest";
import { slideSteps, SWIPE_MIN } from "./gesture";

describe("trotro drag and swipe (R2-11)", () => {
  const pitch = 60;

  it("a drag lands on the nearest space, either way", () => {
    expect(slideSteps(pitch * 2 + 10, pitch)).toBe(2);
    expect(slideSteps(-pitch * 1.6, pitch)).toBe(-2);
    expect(slideSteps(pitch * 0.5, pitch)).toBe(1);
  });

  it("a short swipe still moves one space its way", () => {
    expect(slideSteps(SWIPE_MIN, pitch)).toBe(1);
    expect(slideSteps(-SWIPE_MIN - 4, pitch)).toBe(-1);
  });

  it("a wobble, a cancel or a bad reading moves nothing", () => {
    expect(slideSteps(SWIPE_MIN - 1, pitch)).toBe(0);
    expect(slideSteps(-(SWIPE_MIN - 1), pitch)).toBe(0);
    expect(slideSteps(pitch * 3, pitch, true)).toBe(0);
    expect(slideSteps(Number.NaN, pitch)).toBe(0);
    expect(slideSteps(40, 0)).toBe(0);
  });
});
