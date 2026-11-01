import { describe, expect, it } from "vitest";
import { geometry } from "./logic";
import { boundaryTracks, boxIndex, cageSegments, cellOffsets, digitCounts, gapTotal, isBoundary, trackList } from "./layout";

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

describe("killer cage outlines", () => {
  it("offsets cells by the gaps and thicker box lines", () => {
    expect(cellOffsets(6, 3, 40, 2, 3, 2)).toEqual([2, 44, 86, 129, 171, 213]);
  });

  it("draws a closed inset outline round a 2-cell cage, with room for the total", () => {
    // 2 x 2 board, 10 px cells, 2 px gap: cells 0 and 1 form a cage, 2 and 3 another.
    const segs = cageSegments([0, 0, 1, 1], 2, [0, 12], [0, 12], 10, 1, { w: 4, h: 3 });
    // the top of cell 0 starts after the label and meets the top of cell 1 at the gap's midpoint
    expect(segs).toContainEqual({ x1: 4, y1: 1, x2: 11, y2: 1 });
    expect(segs).toContainEqual({ x1: 11, y1: 1, x2: 21, y2: 1 });
    // the left side of cell 0 starts below the label
    expect(segs).toContainEqual({ x1: 1, y1: 3, x2: 1, y2: 9 });
    // no line between two cells of one cage
    expect(segs.some((s) => s.x1 === s.x2 && (s.x1 === 9 || s.x1 === 13) && s.y1 < 10)).toBe(false);
  });

  it("reaches across the gap at a concave corner", () => {
    // L-shaped cage of cells 0, 2 and 3 on a 2 x 2 board; cell 1 is its own cage.
    const segs = cageSegments([0, 1, 0, 0], 2, [0, 12], [0, 12], 10, 1, { w: 0, h: 0 });
    // the top of cell 3 runs left to the right-side line of cell 0 (x = 9) ...
    expect(segs).toContainEqual({ x1: 9, y1: 13, x2: 21, y2: 13 });
    // ... and that right side runs down to meet it (y = 13)
    expect(segs).toContainEqual({ x1: 9, y1: 1, x2: 9, y2: 13 });
  });
});
