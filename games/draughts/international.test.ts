import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import {
  EMPTY,
  KING0,
  MAN0,
  MAN1,
  KING1,
  applyMove,
  count,
  findMove,
  initialBoard,
  legalMoves,
  notation,
  squareNumber,
  type Board,
} from "./engine";
import draughtsRules, { QUIET_LIMIT_INTL, newDraughts, type DraughtsMatch } from "./rules";
import { draughtsBot } from "@/lib/bot/games/draughts";

/** International draughts, 10 × 10 (owner, 22 Nov 2026: the bigger board, the default). */
const N = 10;
const sq = (r: number, c: number) => r * N + c;
const empty = (): Board => new Array(N * N).fill(EMPTY);
const paths = (b: Board, seat: 0 | 1) => legalMoves(b, seat).map((m) => m.path);

describe("International draughts (10 × 10)", () => {
  it("sets up 20 men each on four rows of dark squares, numbered 1 to 50", () => {
    const b = initialBoard(10);
    expect(b).toHaveLength(100);
    expect(count(b, 0)).toBe(20);
    expect(count(b, 1)).toBe(20);
    // the light side's front row (row 6) has 5 men, each with forward steps; 9 moves in all
    expect(legalMoves(b, 0)).toHaveLength(9);
    expect(squareNumber(1, 10)).toBe(1);
    expect(squareNumber(98, 10)).toBe(50);
    expect(squareNumber(sq(9, 0), 10)).toBe(46);
  });

  it("a new match is International by default, and 8 × 8 is still there", () => {
    expect(draughtsRules.initial(2, createRng("x")).board).toHaveLength(100);
    expect(newDraughts(8).board).toHaveLength(64);
    expect(count(newDraughts(8).board, 0)).toBe(12);
  });

  it("men step forward only, but capture backward too", () => {
    const b = empty();
    b[sq(5, 4)] = MAN0;
    expect(paths(b, 0).sort()).toEqual([
      [sq(5, 4), sq(4, 3)],
      [sq(5, 4), sq(4, 5)],
    ]);
    // an enemy behind it: the man must take it, backward
    b[sq(6, 5)] = MAN1;
    expect(paths(b, 0)).toEqual([[sq(5, 4), sq(7, 6)]]);
  });

  it("kings fly: any distance along a clear diagonal", () => {
    const b = empty();
    b[sq(9, 0)] = KING0;
    b[sq(0, 9)] = MAN1; // far away, not in the way of the long diagonal's last square... it is the last square
    const ms = paths(b, 0);
    // along the long diagonal up to the square before the enemy man (which can't be jumped: the edge is behind it)
    expect(ms).toContainEqual([sq(9, 0), sq(1, 8)]);
    expect(ms).toContainEqual([sq(9, 0), sq(8, 1)]);
    expect(ms).toHaveLength(8);
  });

  it("a flying king captures from a distance and may land on any empty square beyond", () => {
    const b = empty();
    b[sq(9, 0)] = KING0;
    b[sq(5, 4)] = MAN1;
    const ms = paths(b, 0);
    // jump over (5,4) landing on (4,5), (3,6), (2,7), (1,8) or (0,9)
    expect(ms.sort()).toEqual(
      [
        [sq(9, 0), sq(4, 5)],
        [sq(9, 0), sq(3, 6)],
        [sq(9, 0), sq(2, 7)],
        [sq(9, 0), sq(1, 8)],
        [sq(9, 0), sq(0, 9)],
      ].sort(),
    );
  });

  it("you must take the line that captures the most pieces", () => {
    const b = empty();
    // man A can take one; man B can take two in a row
    b[sq(6, 1)] = MAN0;
    b[sq(5, 2)] = MAN1;
    b[sq(6, 7)] = MAN0;
    b[sq(5, 6)] = MAN1;
    b[sq(3, 6)] = MAN1;
    const ms = legalMoves(b, 0);
    expect(ms.every((m) => m.caps.length === 2)).toBe(true);
    expect(ms.map((m) => m.path)).toEqual([[sq(6, 7), sq(4, 5), sq(2, 7)]]);
    expect(findMove(b, 0, [sq(6, 1), sq(4, 3)])).toBeNull();
  });

  it("captured pieces stay until the move ends: no piece is jumped twice", () => {
    const b = empty();
    b[sq(9, 0)] = KING0;
    b[sq(7, 2)] = MAN1;
    b[sq(5, 2)] = MAN1;
    b[sq(5, 4)] = MAN1;
    b[sq(7, 4)] = MAN1;
    for (const m of legalMoves(b, 0)) expect(new Set(m.caps).size).toBe(m.caps.length);
    // Into the middle over (7,2), then out over one more: the pieces already taken block every other way out, so
    // two is the most (a king that could pass through captured pieces would find more).
    expect(legalMoves(b, 0).every((m) => m.caps.length === 2)).toBe(true);
    // A zig-zag the king runs in full: three pieces, each jumped once, landing on any free square past each one.
    const z = empty();
    z[sq(9, 0)] = KING0;
    z[sq(7, 2)] = MAN1;
    z[sq(4, 5)] = MAN1;
    z[sq(2, 5)] = MAN1;
    expect(paths(z, 0).sort()).toEqual(
      [
        [sq(9, 0), sq(6, 3), sq(3, 6), sq(1, 4)],
        [sq(9, 0), sq(6, 3), sq(3, 6), sq(0, 3)],
        [sq(9, 0), sq(5, 4), sq(3, 6), sq(1, 4)],
        [sq(9, 0), sq(5, 4), sq(3, 6), sq(0, 3)],
      ].sort(),
    );
  });

  it("a man is crowned only if it ends its move on the far row", () => {
    const b = empty();
    b[sq(1, 2)] = MAN0;
    b[sq(0, 3)] = EMPTY;
    // a plain step onto row 0 crowns
    const step = legalMoves(b, 0).find((m) => m.path[1] === sq(0, 1))!;
    expect(step.crowns).toBe(true);
    expect(applyMove(b, step)[sq(0, 1)]).toBe(KING0);
    // passing over row 0 mid-capture does not: (2,1) jumps (1,2)... set up a capture through the far row
    const c = empty();
    c[sq(2, 1)] = MAN0;
    c[sq(1, 2)] = MAN1; // jump to (0,3), on the far row
    c[sq(1, 4)] = MAN1; // and on, backward, to (2,5)
    const ms = legalMoves(c, 0);
    expect(ms).toHaveLength(1);
    expect(ms[0].path).toEqual([sq(2, 1), sq(0, 3), sq(2, 5)]);
    expect(ms[0].crowns).toBe(false);
  });

  it("draws after 25 moves each with only kings moving and nothing taken; a man moving resets it", () => {
    const b = empty();
    b[sq(9, 0)] = KING0;
    b[sq(0, 9)] = KING1;
    b[sq(6, 3)] = MAN0;
    const s: DraughtsMatch = { board: b, turn: 0, quiet: QUIET_LIMIT_INTL - 1, moves: [] };
    const kingMove = legalMoves(b, 0).find((m) => m.path[0] === sq(9, 0))!.path;
    const after = draughtsRules.apply(s, 0, kingMove, createRng("q"));
    expect(after.quiet).toBe(QUIET_LIMIT_INTL);
    expect(draughtsRules.status(after)).toMatchObject({ over: true, winner: null });
    const manMove = legalMoves(b, 0).find((m) => m.path[0] === sq(6, 3))!.path;
    expect(draughtsRules.apply(s, 0, manMove, createRng("q")).quiet).toBe(0);
  });

  it("writes moves in the 1 to 50 numbering", () => {
    const b = initialBoard(10);
    const m = legalMoves(b, 0)[0];
    expect(notation(m, 10)).toMatch(/^\d+-\d+$/);
  });

  it("the server takes a whole game: the bot plays both sides to the end without an illegal move", async () => {
    let s = newDraughts(10);
    const rng = createRng("game");
    for (let ply = 0; ply < 400 && !draughtsRules.status(s).over; ply++) {
      const move = draughtsRules.botMove!(s, s.turn, rng);
      expect(draughtsRules.isLegal(s, s.turn, move)).toBe(true);
      s = draughtsRules.apply(s, s.turn, move, rng);
    }
    expect(s.moves.length).toBeGreaterThan(10);
  });

  it("the stronger bot finds a legal move on the 10 × 10 board quickly", async () => {
    const s = newDraughts(10);
    const t0 = Date.now();
    const move = draughtsBot.choose(s, 0, "hard", createRng("bot"));
    expect(draughtsRules.isLegal(s, 0, move)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
