import { describe, expect, it } from "vitest";
import { STROKE_LIMITS, StrokeBatch, fitsDrawing, pointsIn, strokePath, toStrokes } from "./strokes";

describe("Draw It strokes", () => {
  it("accepts preset colours and widths with integer points on the board", () => {
    expect(StrokeBatch.safeParse([{ c: 0, w: 1, p: [0, 0, 1000, 1000] }]).success).toBe(true);
  });
  it("refuses anything that isn't a plain stroke: images, text, odd points, off-board or fractional points", () => {
    const bad = [
      [{ c: 0, w: 0, p: [0, 0], img: "data:image/png;base64,AAAA" }],
      [{ c: 0, w: 0, p: [0, 0], text: "hello" }],
      [{ c: 0, w: 0, p: [0, 0, 5] }],
      [{ c: 0, w: 0, p: [0, 1001] }],
      [{ c: 0, w: 0, p: [0.5, 1] }],
      [{ c: 9, w: 0, p: [0, 0] }],
      [{ c: 0, w: 7, p: [0, 0] }],
      [{ c: 0, w: 0, p: new Array(STROKE_LIMITS.pointsPerStroke * 2 + 2).fill(1) }],
      Array.from({ length: STROKE_LIMITS.perBatch + 1 }, () => ({ c: 0, w: 0, p: [1, 1] })),
      [],
      "M0 0L10 10",
    ];
    for (const b of bad) expect(StrokeBatch.safeParse(b).success, JSON.stringify(b).slice(0, 60)).toBe(false);
  });
  it("caps a drawing's strokes and points", () => {
    const one = [{ c: 0, w: 0, p: [0, 0, 1, 1] }];
    expect(fitsDrawing({ strokes: STROKE_LIMITS.strokes - 1, points: 0 }, one)).toBe(true);
    expect(fitsDrawing({ strokes: STROKE_LIMITS.strokes, points: 0 }, one)).toBe(false);
    expect(fitsDrawing({ strokes: 0, points: STROKE_LIMITS.points - 1 }, one)).toBe(false);
    expect(pointsIn(one)).toBe(2);
  });
  it("turns a pointer path into server-sized strokes, joined across splits", () => {
    const path = Array.from({ length: 450 }, (_, i) => [i * 2, (i % 2) * 10] as [number, number]);
    const s = toStrokes(path, 1, 2);
    expect(s.length).toBe(3);
    for (const x of s) expect(StrokeBatch.safeParse([x]).success).toBe(true);
    expect(s[1].p.slice(0, 2)).toEqual(s[0].p.slice(-2));
    // A tap is a dot; jitter under the gap is dropped; points are clamped to the board.
    expect(toStrokes([[10, 10]], 0, 0)[0].p).toEqual([10, 10, 10, 10]);
    expect(
      toStrokes(
        [
          [-20, 1200],
          [-19, 1199],
        ],
        0,
        0,
      )[0].p,
    ).toEqual([0, 1000, 0, 1000]);
    expect(strokePath({ c: 0, w: 0, p: [1, 2, 3, 4] })).toBe("M1 2L3 4");
  });
});
