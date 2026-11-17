import { describe, expect, it } from "vitest";
import { isSideways, isWide } from "@/components/game/useBoardSize";

describe("isSideways: a phone held sideways (Gotcha and Dash put their controls either side)", () => {
  it("phones turned on their side", () => {
    expect(isSideways(844, 390)).toBe(true); // iPhone 14
    expect(isSideways(915, 412)).toBe(true); // Pixel 7
    expect(isSideways(568, 320)).toBe(true); // iPhone SE (1st gen)
  });
  it("never a phone held upright, a laptop or a tablet (the two-column shell takes those)", () => {
    expect(isSideways(390, 844)).toBe(false);
    expect(isSideways(1280, 800)).toBe(false);
    expect(isSideways(1180, 820)).toBe(false);
  });
  it("never both sideways and wide", () => {
    for (const [w, h] of [
      [844, 390],
      [900, 599],
      [900, 600],
      [1024, 768],
      [560, 400],
      [559, 320],
    ])
      expect(isSideways(w, h) && isWide(w, h)).toBe(false);
  });
});
