import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { countOf, flipsFor, initialGrid, legalSquares, place, sqName } from "./engine";
import logic, { countSolutions, generate, grade, hint, options, verify } from "./logic";
import flipRules, { type FlipMatch } from "./rules";

describe("flip engine (Reversi rules)", () => {
  it("opens with four discs and four legal moves", () => {
    const g = initialGrid();
    expect(countOf(g, 1)).toBe(2);
    expect(legalSquares(g, 1).map(sqName).sort()).toEqual(["c5", "d6", "e3", "f4"]);
    expect(flipsFor(g, 27, 1)).toEqual([]);
    expect(flipsFor(g, 99, 1)).toEqual([]);
    expect(() => place(g, 0, 1)).toThrow();
  });

  it("flips every outflanked line, nearest first", () => {
    const g = new Array(64).fill(0);
    // light at a1 row? build a star: centre d4 (27) empty, rivals around, light beyond
    const centre = 27;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) {
      g[centre + dr * 8 + dc] = 2;
      g[centre + dr * 16 + dc * 2] = 1;
    }
    g[centre + 1 + 8] = 2;
    const f = flipsFor(g, centre, 1);
    expect(f).toHaveLength(5);
    const after = place(g, centre, 1);
    expect(countOf(after, 2)).toBe(0);
  });
});

describe("flip puzzles", { timeout: 60_000 }, () => {
  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a deterministic ${d} puzzle with one biggest flip`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(generate(createRng(`daily:2026-11-02:${d}`), d)).toEqual(a);
      expect(countSolutions(a.puzzle, 3)).toBe(1);
      expect(flipsFor(a.puzzle.grid, a.solution.sq, 1)).toHaveLength(a.solution.flips);
    });
  }

  it("has one biggest flip over 25 seeds", () => {
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), (["easy", "medium", "hard", "expert", "mega"] as const)[i % 5]);
      expect(countSolutions(g.puzzle)).toBe(1);
      expect(verify(g.puzzle, g.solution, { sq: g.solution.sq }).ok).toBe(true);
    }
  });

  it("verifies the answer and rejects others and junk", () => {
    const g = generate(createRng("verify"), "hard");
    expect(verify(g.puzzle, g.solution, { sq: g.solution.sq })).toEqual({ ok: true, progress: 1, score: g.solution.flips });
    const other = options(g.puzzle.grid).find((o) => o.sq !== g.solution.sq)!;
    expect(verify(g.puzzle, g.solution, { sq: other.sq })).toMatchObject({ ok: false, score: other.flips });
    const filled = g.puzzle.grid.findIndex((x) => x);
    expect(verify(g.puzzle, g.solution, { sq: filled }).reason).toBe("illegal square");
    expect(verify(g.puzzle, g.solution, { sq: null }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, 3 as never).ok).toBe(false);
    expect(logic.progress(g.puzzle, g.solution, { sq: g.solution.sq })).toBe(1);
    expect(logic.progress(g.puzzle, g.solution, { sq: other.sq })).toBe(0);
    expect(countSolutions({ grid: new Array(64).fill(0) })).toBe(0);
  });

  it("hints name the square and stop once found", () => {
    const g = generate(createRng("hint"), "medium");
    expect(hint(g.puzzle, g.solution, { sq: null })?.target).toBe(g.solution.sq);
    expect(hint(g.puzzle, g.solution, { sq: g.solution.sq })).toBeNull();
    expect(hint(g.puzzle, g.solution, "x" as never)?.target).toBe(g.solution.sq);
  });

  it("grades harder days higher", () => {
    const avg = (d: Difficulty) => [0, 1, 2, 3].reduce((s, i) => s + generate(createRng(`g${i}`), d).grade, 0) / 4;
    expect(avg("easy")).toBeLessThan(avg("medium"));
    expect(avg("medium")).toBeLessThan(avg("mega"));
    expect(grade(generate(createRng("x"), "easy").puzzle)).toBeLessThan(80);
  });
});

describe("flip match rules", () => {
  const rng = createRng("m");
  it("validates turns, flips and passes", () => {
    const s = flipRules.initial(2, rng);
    expect(flipRules.legalMoves(s, 0)).toHaveLength(4);
    expect(flipRules.legalMoves(s, 1)).toEqual([]);
    expect(flipRules.isLegal(s, 1, 19)).toBe(false);
    expect(() => flipRules.apply(s, 1, 19, rng)).toThrow();
    expect(() => flipRules.apply(s, 0, 0, rng)).toThrow();
    const s2 = flipRules.apply(s, 0, legalSquares(s.grid, 1)[0], rng);
    expect(flipRules.turn(s2)).toBe(1);
    // the other side has no move: the mover keeps the turn
    const g = new Array(64).fill(0);
    g[0] = 1;
    g[1] = 2;
    g[3] = 2;
    g[4] = 1;
    const t: FlipMatch = { grid: g, turn: 0, moves: [] };
    const t2 = flipRules.apply(t, 0, 2, rng);
    expect(countOf(t2.grid, 2)).toBe(0);
    expect(flipRules.status(t2)).toMatchObject({ over: true, winner: 0 });
  });

  it("practice bot finishes a game with legal moves and takes corners", () => {
    const r = createRng("bot");
    let s = flipRules.initial(2, r);
    while (!flipRules.status(s).over) {
      const seat = flipRules.turn(s);
      const m = flipRules.botMove!(s, seat, r);
      expect(flipRules.isLegal(s, seat, m)).toBe(true);
      s = flipRules.apply(s, seat, m, r);
    }
    expect(flipRules.status(s).over).toBe(true);
    const g = new Array(64).fill(0);
    g[1] = 2;
    g[2] = 1;
    g[20] = 2;
    g[28] = 1;
    g[12] = 2;
    g[4] = 1;
    expect(flipRules.botMove!({ grid: g, turn: 0, moves: [] }, 0, r)).toBe(0);
    expect(() => flipRules.botMove!({ grid: new Array(64).fill(0), turn: 0, moves: [] }, 0, r)).toThrow();
    const tie = new Array(64).fill(1);
    for (let i = 0; i < 32; i++) tie[i] = 2;
    expect(flipRules.status({ grid: tie, turn: 0, moves: [] })).toMatchObject({ over: true, winner: null });
  });
});
