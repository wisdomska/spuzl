import { describe, expect, it } from "vitest";
import { geometry } from "./logic";
import { boundaryTracks, boxIndex, digitCounts, gapTotal, isBoundary, trackList } from "./layout";

describe("sudoku layout", () => {
  it("numbers 3 x 3 boxes left to right, top to bottom", () => {
    expect(boxIndex(0, 9, 3, 3)).toBe(0);
    expect(boxIndex(1 * 9 + 4, 9, 3, 3)).toBe(1); // row 2, column 5 is box 2 (1-based)
    expect(boxIndex(3 * 9 + 0, 9, 3, 3)).toBe(3);
    expect(boxIndex(80, 9, 3, 3)).toBe(8);
  });

  it("numbers 2 x 3 Sixer boxes (3 wide, 2 tall)", () => {
    expect(boxIndex(0, 6, 3, 2)).toBe(0);
    expect(boxIndex(5, 6, 3, 2)).toBe(1);
    expect(boxIndex(2 * 6 + 0, 6, 3, 2)).toBe(2);
    expect(boxIndex(35, 6, 3, 2)).toBe(5);
  });

  it("agrees with the engine's box units", () => {
    for (const [n, w, h] of [
      [9, 3, 3],
      [6, 3, 2],
    ]) {
      const g = geometry(n, w, h);
      for (const u of g.units.filter((u) => u.kind === "box")) for (const i of u.cells) expect(boxIndex(i, n, w, h)).toBe(u.index);
    }
  });

  it("puts thicker lines only on box boundaries", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].filter((k) => isBoundary(k, 3, 9))).toEqual([2, 5]);
    expect(trackList(6, 3, 40, 2, 4)).toBe("40px 2px 40px 2px 40px 4px 40px 2px 40px 2px 40px");
    expect(trackList(6, 2, 40, 2, 4)).toBe("40px 2px 40px 4px 40px 2px 40px 4px 40px 2px 40px");
    expect(boundaryTracks(9, 3)).toEqual([6, 12]);
    expect(boundaryTracks(6, 2)).toEqual([4, 8]);
    expect(gapTotal(9, 3, 1, 2)).toBe(6 * 1 + 2 * 2);
  });

  it("counts digits on the board", () => {
    expect(digitCounts([1, 0, 1, 3, 0, 2], 3)).toEqual([2, 2, 1, 1]);
  });
});
