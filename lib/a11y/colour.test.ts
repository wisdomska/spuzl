import { describe, expect, it } from "vitest";
import { contrastRatio, deltaE2000, parseHex, simulate, toHex, toLab, visibleDifference, VISIONS } from "./colour";

describe("colour maths", () => {
  it("matches the Sharma, Wu & Dalal CIEDE2000 reference pairs", () => {
    const pairs: [[number, number, number], [number, number, number], number][] = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 0, 0], [50, -1, 2], 2.3669],
      [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
      [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
      [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
    ];
    for (const [a, b, want] of pairs) {
      expect(deltaE2000(a, b)).toBeCloseTo(want, 3);
      expect(deltaE2000(b, a)).toBeCloseTo(want, 3);
    }
  });

  it("converts sRGB to Lab", () => {
    const [L, a, b] = toLab(parseHex("#ffffff"));
    expect(L).toBeCloseTo(100, 2);
    expect(a).toBeCloseTo(0, 2);
    expect(b).toBeCloseTo(0, 2);
    expect(toLab(parseHex("#ff0000"))[0]).toBeCloseTo(53.24, 1);
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio(parseHex("#000"), parseHex("#fff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseHex("#777777"), parseHex("#ffffff"))).toBeCloseTo(4.48, 2);
  });

  it("keeps greys grey under every simulation and merges red and green for red-green dichromats", () => {
    for (const v of VISIONS) expect(toHex(simulate(parseHex("#808080"), v))).toBe("#808080");
    const red = parseHex("#d03030"),
      green = parseHex("#6a8a00");
    expect(visibleDifference(red, green, "normal")).toBeGreaterThan(30);
    expect(visibleDifference(red, green, "deuteranopia")).toBeLessThan(visibleDifference(red, green, "normal") / 2);
    expect(visibleDifference(red, green, "protanopia")).toBeLessThan(visibleDifference(red, green, "normal") / 2);
  });
});
