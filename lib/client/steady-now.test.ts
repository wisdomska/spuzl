import { describe, expect, it } from "vitest";
import { CLOCK_WOBBLE_MS, steadyNow } from "./multiplayer";

describe("steadyNow (R4-18: a match clock never steps back on network wobble)", () => {
  it("holds through a small step back and moves on with time", () => {
    expect(steadyNow(10_000, 9_400)).toBe(10_000);
    expect(steadyNow(10_000, 10_200)).toBe(10_200);
  });
  it("takes a real correction at once (a device clock that is off)", () => {
    expect(steadyNow(10_000, 10_000 - CLOCK_WOBBLE_MS - 1)).toBe(10_000 - CLOCK_WOBBLE_MS - 1);
    expect(steadyNow(500_000, 200_000)).toBe(200_000);
  });
});
