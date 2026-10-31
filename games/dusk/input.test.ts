import { describe, expect, it } from "vitest";
import { EMPTY, MOON, SUN, type DuskPuzzle } from "./logic";
import { isSlip, tapMark } from "./input";
import { logicGames } from "@/lib/copy/logic-games";

const blank = (n: number): DuskPuzzle => ({ size: n, givens: new Array(n * n).fill(EMPTY), links: [] });

describe("dusk input", () => {
  it("one tap is a sun, a double-tap a moon, a third tap clears", () => {
    expect(tapMark(EMPTY, null)).toBe(SUN);
    expect(tapMark(tapMark(EMPTY, null), null)).toBe(MOON);
    expect(tapMark(MOON, null)).toBe(EMPTY);
  });

  it("tools place their mark or clear it", () => {
    expect(tapMark(EMPTY, "sun")).toBe(SUN);
    expect(tapMark(MOON, "sun")).toBe(SUN);
    expect(tapMark(SUN, "sun")).toBe(EMPTY);
    expect(tapMark(SUN, "moon")).toBe(MOON);
    expect(tapMark(MOON, "moon")).toBe(EMPTY);
  });

  it("a cell passing through sun on its way to moon is not a slip", () => {
    const p = blank(6);
    const before = new Array(36).fill(EMPTY);
    before[0] = before[1] = SUN;
    // The transient sun at 2 would make three in a row, but the settled moon is fine.
    const transient = before.slice();
    transient[2] = SUN;
    expect(isSlip(p, before, transient, 2)).toBe(true);
    const settled = before.slice();
    settled[2] = MOON;
    expect(isSlip(p, before, settled, 2)).toBe(false);
  });

  it("only counts a slip when the settled board is invalid at that cell and got worse", () => {
    const p: DuskPuzzle = { ...blank(6), links: [{ a: 0, b: 1, same: true }] };
    const before = new Array(36).fill(EMPTY);
    before[0] = SUN;
    const moon = before.slice();
    moon[1] = MOON;
    expect(isSlip(p, before, moon, 1)).toBe(true);
    const sun = before.slice();
    sun[1] = SUN;
    expect(isSlip(p, before, sun, 1)).toBe(false);
    // Clearing a broken cell, or a burst that ends where it began, is never a slip.
    expect(isSlip(p, moon, before, 1)).toBe(false);
    expect(isSlip(p, moon, moon, 1)).toBe(false);
  });

  it("reads = and × in cell labels with the row and column prefix", () => {
    const t = logicGames.dusk;
    expect([t.cellPrefix(1, 2), t.mark.sun, t.link(true, "right")].join(", ")).toBe("Row 1, column 2, sun, equals the cell to the right");
    expect(t.link(false, "below")).toBe("is opposite to the cell below");
  });
});
