import { describe, expect, it } from "vitest";
import { fromView, toView, viewDims } from "./rotate";

describe("grid view rotation", () => {
  it("swaps the shape on odd quarter turns and takes any turn count mod 4", () => {
    expect(viewDims(6, 5, 0)).toEqual([6, 5]);
    expect(viewDims(6, 5, 1)).toEqual([5, 6]);
    expect(viewDims(6, 5, 2)).toEqual([6, 5]);
    expect(viewDims(6, 5, 7)).toEqual([5, 6]);
    expect(viewDims(6, 5, -1)).toEqual([5, 6]);
  });

  it("turns clockwise: the top left corner goes to the top right", () => {
    // 2 x 3 grid:  A B C      quarter turn:  D A
    //              D E F                     E B
    //                                        F C
    expect(toView(0, 2, 3, 1)).toEqual([0, 1]);
    expect(toView(3, 2, 3, 1)).toEqual([0, 0]);
    expect(toView(5, 2, 3, 1)).toEqual([2, 0]);
    expect(toView(0, 2, 3, 2)).toEqual([1, 2]);
    expect(toView(0, 2, 3, 3)).toEqual([2, 0]);
    expect(toView(4, 2, 3, 0)).toEqual([1, 1]);
  });

  it("fromView inverts toView for every cell, shape and turn, and four turns are the identity", () => {
    for (const [rows, cols] of [
      [1, 1],
      [2, 3],
      [6, 5],
      [9, 7],
    ]) {
      for (let t = -4; t <= 8; t++) {
        const [vr, vc] = viewDims(rows, cols, t);
        const hit = new Set<number>();
        for (let i = 0; i < rows * cols; i++) {
          const [r, c] = toView(i, rows, cols, t);
          expect(fromView(r, c, rows, cols, t)).toBe(i);
          expect(toView(i, rows, cols, t + 4)).toEqual([r, c]);
          hit.add(r * vc + c);
        }
        expect(hit.size).toBe(vr * vc);
      }
    }
  });
});
