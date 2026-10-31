import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import {
  COLS,
  bestDefence,
  drop,
  dropRow,
  emptyGrid,
  lineThrough,
  openCols,
  winDistance,
  winIn,
  winner,
  winningCols,
  type Grid,
} from "./engine";
import logic, { COPY, WIN_FOR, countSolutions, generate, grade, hint, replay, solveLine, verify } from "./logic";
import fourupRules, { type FourUpMatch } from "./rules";

const build = (moves: [number, number][]): Grid => moves.reduce((g, [c, w]) => drop(g, c, w), emptyGrid());

describe("four up engine", () => {
  it("drops with gravity and finds lines in every direction", () => {
    let g = emptyGrid();
    expect(dropRow(g, 3)).toBe(5);
    g = drop(g, 3, 1);
    expect(dropRow(g, 3)).toBe(4);
    expect(dropRow(g, 9)).toBe(-1);
    const h = build([
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    expect(winner(h)?.line).toHaveLength(4);
    const v = build([
      [0, 2],
      [0, 2],
      [0, 2],
      [0, 2],
    ]);
    expect(winner(v)?.who).toBe(2);
    const d = build([
      [0, 1],
      [1, 2],
      [1, 1],
      [2, 2],
      [2, 2],
      [2, 1],
      [3, 2],
      [3, 2],
      [3, 2],
      [3, 1],
    ]);
    expect(winner(d)?.who).toBe(1);
    const a = build([
      [3, 1],
      [2, 2],
      [2, 1],
      [1, 2],
      [1, 2],
      [1, 1],
      [0, 2],
      [0, 2],
      [0, 2],
      [0, 1],
    ]);
    expect(winner(a)?.who).toBe(1);
    expect(lineThrough(emptyGrid(), 0)).toBeNull();
    let full = emptyGrid();
    for (let i = 0; i < 6; i++) full = drop(full, 0, 1 + (i % 2));
    expect(() => drop(full, 0, 1)).toThrow();
    expect(openCols(full)).not.toContain(0);
  });

  it("solves wins in 1 and 2 and defends", () => {
    const g = build([
      [0, 1],
      [6, 2],
      [1, 1],
      [6, 2],
      [2, 1],
      [5, 2],
    ]);
    expect(winIn(g, 1, 1)).toBe(true);
    expect(winningCols(g, 1, 1)).toEqual([3]);
    expect(winDistance(g, 1, 3)).toBe(1);
    // open three on the bottom row: either end wins, so a win in 2 from two in a row
    const two = build([
      [2, 1],
      [2, 2],
      [3, 1],
      [3, 2],
    ]);
    expect(winIn(two, 1, 2)).toBe(true);
    expect(winIn(two, 1, 1)).toBe(false);
    const after = drop(two, 4, 1);
    expect([1, 5]).toContain(bestDefence(after, 1, 1));
  });
});

describe("four up puzzles", { timeout: 60_000 }, () => {
  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a deterministic, unique ${d} win in ${WIN_FOR[d]}`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(generate(createRng(`daily:2026-11-02:${d}`), d)).toEqual(a);
      expect(countSolutions(a.puzzle, 3)).toBe(1);
      expect(winDistance(a.puzzle.grid, 1, WIN_FOR[d])).toBe(WIN_FOR[d]);
      expect(solveLine(a.puzzle)).toEqual(a.solution.line);
    });
  }

  it("generates unique puzzles over 25 seeds", () => {
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), i % 2 ? "medium" : "hard");
      expect(countSolutions(g.puzzle)).toBe(1);
      const mine = g.solution.line.filter((_, k) => k % 2 === 0);
      expect(verify(g.puzzle, g.solution, { cols: mine }).ok).toBe(true);
    }
  });

  it("verifies the solution and rejects near misses and junk", () => {
    const g = generate(createRng("verify"), "hard");
    const mine = g.solution.line.filter((_, k) => k % 2 === 0);
    expect(verify(g.puzzle, g.solution, { cols: mine })).toEqual({ ok: true, progress: 1 });
    expect(verify(g.puzzle, g.solution, { cols: mine.slice(0, 1) })).toMatchObject({ ok: false, reason: "incomplete" });
    const other = openCols(g.puzzle.grid).find((c) => c !== mine[0])!;
    expect(verify(g.puzzle, g.solution, { cols: [other] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { cols: [] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { cols: ["a"] } as never).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as never).ok).toBe(false);
    // a second drop that throws the win away
    const r1 = replay(g.puzzle, mine.slice(0, 1));
    const bad = openCols(r1.grid).find((c) => !replay(g.puzzle, [mine[0], c]).won && replay(g.puzzle, [mine[0], c]).wrongAt >= 0);
    if (bad !== undefined) expect(verify(g.puzzle, g.solution, { cols: [mine[0], bad] }).reason).toBe("drop does not keep the win");
    // a full column is illegal
    let full = g.puzzle.grid.slice();
    const col = openCols(full)[0];
    while (dropRow(full, col) >= 0) full = drop(full, col, 2);
    const fp = { grid: full, winIn: 2 };
    expect(replay(fp, [col]).illegal).toBe(true);
  });

  it("reports progress without leaking the line", () => {
    const g = generate(createRng("progress"), "hard");
    const mine = g.solution.line.filter((_, k) => k % 2 === 0);
    expect(logic.progress(g.puzzle, g.solution, { cols: [] })).toBe(0);
    expect(logic.progress(g.puzzle, g.solution, { cols: mine.slice(0, 1) })).toBeCloseTo(1 / 3);
    expect(logic.progress(g.puzzle, g.solution, { cols: mine })).toBe(1);
    expect(logic.progress(g.puzzle, g.solution, 1 as never)).toBe(0);
  });

  it("hints are safe: following them wins", () => {
    const g = generate(createRng("hint"), "expert");
    const cols: number[] = [];
    for (let k = 0; k < 4; k++) {
      const h = hint(g.puzzle, g.solution, { cols });
      if (!h) break;
      cols.push(h.target as number);
    }
    expect(verify(g.puzzle, g.solution, { cols }).ok).toBe(true);
    expect(hint(g.puzzle, g.solution, { cols })).toBeNull();
    const other = openCols(g.puzzle.grid).find((c) => c !== g.solution.line[0])!;
    expect(hint(g.puzzle, g.solution, { cols: [other] })?.text).toMatch(/Undo/);
  });

  it("grades longer wins higher", () => {
    const avg = (d: Difficulty) => [0, 1, 2].reduce((s, i) => s + generate(createRng(`g${i}`), d).grade, 0) / 3;
    expect(avg("medium")).toBeLessThan(avg("hard"));
    expect(avg("expert")).toBeLessThan(avg("mega"));
    expect(grade(generate(createRng("x"), "easy").puzzle)).toBeLessThan(50);
    expect(COPY.win).toBeTruthy();
  });
});

describe("four up match rules", () => {
  const rng = createRng("m");
  it("alternates seats and validates columns", () => {
    let s = fourupRules.initial(2, rng);
    expect(fourupRules.legalMoves(s, 0)).toHaveLength(COLS);
    expect(fourupRules.legalMoves(s, 1)).toEqual([]);
    expect(fourupRules.isLegal(s, 0, 7)).toBe(false);
    expect(() => fourupRules.apply(s, 1, 0, rng)).toThrow();
    expect(() => fourupRules.apply(s, 0, 9, rng)).toThrow();
    for (const [seat, c] of [
      [0, 0],
      [1, 6],
      [0, 1],
      [1, 6],
      [0, 2],
      [1, 6],
      [0, 3],
    ] as const)
      s = fourupRules.apply(s, seat, c, rng);
    expect(fourupRules.status(s)).toEqual({ over: true, winner: 0, reason: "four in a line" });
    expect(() => fourupRules.apply(s, 1, 5, rng)).toThrow("game over");
  });

  it("draws on a full board", () => {
    // column pattern that fills the board with no four
    const order = [0, 1, 2, 3, 4, 5, 6];
    let g = emptyGrid();
    const moves: number[] = [];
    for (let row = 0; row < 6; row++)
      for (const c of order) {
        const who = ((c + Math.floor(row / 2)) % 2) + 1;
        g = drop(g, c, who);
        moves.push(c);
      }
    const s: FourUpMatch = { grid: g, moves };
    if (!winner(g)) expect(fourupRules.status(s)).toEqual({ over: true, winner: null, reason: "board full" });
  });

  it("practice bot wins, blocks and plays legal drops", () => {
    const r = createRng("bot");
    let s = fourupRules.initial(2, r);
    while (!fourupRules.status(s).over) {
      const seat = fourupRules.turn(s);
      const c = fourupRules.botMove!(s, seat, r);
      expect(fourupRules.isLegal(s, seat, c)).toBe(true);
      s = fourupRules.apply(s, seat, c, r);
    }
    const win: FourUpMatch = {
      grid: build([
        [0, 1],
        [6, 2],
        [1, 1],
        [6, 2],
        [2, 1],
        [5, 2],
      ]),
      moves: [0, 6, 1, 6, 2, 5],
    };
    expect(fourupRules.botMove!(win, 0, r)).toBe(3);
    const blk: FourUpMatch = {
      grid: build([
        [0, 1],
        [6, 2],
        [1, 1],
        [6, 2],
        [2, 1],
      ]),
      moves: [0, 6, 1, 6, 2],
    };
    expect(fourupRules.botMove!(blk, 1, r)).toBe(3);
    let full = emptyGrid();
    for (let c = 0; c < 7; c++) for (let k = 0; k < 6; k++) full = drop(full, c, 1 + ((k + (c % 3 === 0 ? 1 : 0)) % 2));
    expect(() => fourupRules.botMove!({ grid: full, moves: [] }, 0, r)).toThrow();
  });
});
