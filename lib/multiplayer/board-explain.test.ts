import { describe, expect, it } from "vitest";
import { initialBoard, legalMoves } from "@/games/draughts/engine";
import { legalPits } from "@/games/oware/engine";
import { draughtsTapReason, isCapturePath, narrowRoute, owareTapReason } from "./board-explain";

describe("narrowRoute (two captures ending on one square)", () => {
  // From 0, two routes land on 20: through 2 or through 18 (squares only, the rules are not checked here).
  const paths = [
    [0, 2, 20],
    [0, 18, 20],
    [0, 18, 36],
    [5, 7],
  ];
  it("moves at once when one path ends there", () => {
    expect(narrowRoute(paths, [0], 36)).toEqual({ move: [0, 18, 36] });
  });
  it("offers the hops that tell the paths apart", () => {
    expect(narrowRoute(paths, [0], 20)).toEqual({
      prefix: [0],
      hops: [2, 18],
      paths: [
        [0, 2, 20],
        [0, 18, 20],
      ],
    });
  });
  it("picks the path once a hop is chosen", () => {
    expect(narrowRoute(paths, [0, 18], 20)).toEqual({ move: [0, 18, 20] });
  });
  it("skips landings every path shares", () => {
    const long = [
      [0, 2, 4, 20],
      [0, 2, 6, 20],
    ];
    expect(narrowRoute(long, [0], 20)).toEqual({ prefix: [0, 2], hops: [4, 6], paths: long });
  });
});

describe("isCapturePath", () => {
  it("tells a jump from a step", () => {
    expect(isCapturePath([42, 33])).toBe(false);
    expect(isCapturePath([42, 24])).toBe(true);
    expect(isCapturePath([42])).toBe(false);
  });
});

describe("draughtsTapReason", () => {
  it("is null for a man that can move, an empty square, the other side's man, or off turn", () => {
    const b = initialBoard();
    const paths = legalMoves(b, 0).map((m) => m.path);
    const movable = paths[0][0];
    expect(draughtsTapReason(b, paths, movable, 0)).toBeNull();
    expect(draughtsTapReason(b, paths, 36, 0)).toBeNull(); // empty middle square
    expect(draughtsTapReason(b, paths, 1, 0)).toBeNull(); // seat 1's man
    expect(draughtsTapReason(b, [], 63 - 7, 0)).toBeNull(); // not your turn: no paths
  });
  it("says blocked for a back-row man with nowhere to go", () => {
    const b = initialBoard();
    const paths = legalMoves(b, 0).map((m) => m.path);
    const back = b.findIndex((p, sq) => p === 1 && sq >> 3 === 7);
    expect(draughtsTapReason(b, paths, back, 0)).toBe("blocked");
  });
  it("says capture when a capture is compulsory elsewhere", () => {
    const b = new Array(64).fill(0);
    // seat 0 men move up the board (to lower rows); one can take, the other could only step
    b[42] = 1; // c3... can jump 33 to 24
    b[33] = 3;
    b[46] = 1; // a free man far from the action
    const paths = legalMoves(b, 0).map((m) => m.path);
    expect(paths.every(isCapturePath)).toBe(true);
    expect(draughtsTapReason(b, paths, 46, 0)).toBe("capture");
  });
});

describe("owareTapReason", () => {
  it("is null for a legal pit or the other side's pit", () => {
    const pits = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    expect(owareTapReason(pits, legalPits(pits, 0), 2, 0)).toBeNull();
    expect(owareTapReason(pits, legalPits(pits, 0), 8, 0)).toBeNull();
  });
  it("says empty for an empty pit of yours", () => {
    const pits = [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    expect(owareTapReason(pits, legalPits(pits, 0), 0, 0)).toBe("empty");
  });
  it("says feed when their side is empty and the pit can't reach it", () => {
    const pits = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
    const legal = legalPits(pits, 0);
    expect(legal).toEqual([5]);
    expect(owareTapReason(pits, legal, 0, 0)).toBe("feed");
  });
  it("reads seat 1's pits as 6 to 11", () => {
    const pits = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4];
    expect(owareTapReason(pits, legalPits(pits, 1), 6, 1)).toBe("empty");
    expect(owareTapReason(pits, legalPits(pits, 1), 0, 1)).toBeNull();
  });
});
