import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import {
  HOME,
  SAFE,
  TRACK,
  absOf,
  applyStep,
  baseOfCell,
  cellOf,
  coloursFor,
  homeColOfCell,
  legalSteps,
  target,
  threatened,
  trackIndexOfCell,
  type Table,
} from "./engine";
import logic, { MARGIN, countSolutions, explain, generate, grade, hint, ranked, scoreStep, verify, type LudoPuzzle } from "./logic";
import ludoRules, { SHAPES, type LudoMatch } from "./rules";

const fixed = (rolls: number[]): Rng => {
  const r = createRng("fixed");
  let i = 0;
  return { ...r, int: () => rolls[i++ % rolls.length] };
};

describe("ludo engine", () => {
  it("lays out a 52-square loop with home columns and bases", () => {
    expect(TRACK).toHaveLength(52);
    expect(new Set(TRACK.map(([r, c]) => r * 15 + c)).size).toBe(52);
    for (let k = 0; k < 52; k++) {
      const [a, b] = TRACK[k],
        [c, d] = TRACK[(k + 1) % 52];
      expect(Math.abs(a - c) + Math.abs(b - d)).toBeLessThanOrEqual(2);
    }
    expect(cellOf(0, 0, 0)).toEqual([6, 1]);
    expect(cellOf(1, 0, 0)).toEqual([1, 8]);
    expect(cellOf(2, 0, 0)).toEqual([8, 13]);
    expect(cellOf(3, 0, 0)).toEqual([13, 6]);
    expect(cellOf(0, 0, 50)).toEqual([7, 0]);
    expect(cellOf(0, 0, 51)).toEqual([7, 1]);
    expect(cellOf(2, 0, 55)).toEqual([7, 9]);
    expect(cellOf(1, 3, -1)).toEqual([4, 13]);
    expect(cellOf(3, 1, HOME)).toEqual([7, 7]);
    expect(baseOfCell(0, 0)).toBe(0);
    expect(baseOfCell(14, 14)).toBe(2);
    expect(baseOfCell(7, 7)).toBe(-1);
    expect(homeColOfCell(3, 7)).toBe(1);
    expect(homeColOfCell(0, 0)).toBe(-1);
    expect(trackIndexOfCell(6, 1)).toBe(0);
    expect(coloursFor(2)).toEqual([0, 2]);
    expect(coloursFor(3)).toEqual([0, 1, 2]);
    expect(SHAPES).toHaveLength(4);
  });

  it("needs a 6 to come out and exact rolls to get home", () => {
    expect(target(-1, 5)).toBe(-2);
    expect(target(-1, 6)).toBe(0);
    expect(target(53, 3)).toBe(HOME);
    expect(target(53, 4)).toBe(-2);
    const t: Table = {
      colours: [0, 2],
      pieces: [
        [-1, 10, HOME, 54],
        [-1, -1, -1, -1],
      ],
    };
    expect(legalSteps(t, 0, 3).map((s) => s.piece)).toEqual([1]);
    expect(legalSteps(t, 0, 6).map((s) => s.piece)).toEqual([0, 1]);
  });

  it("captures on plain squares, never on safe ones", () => {
    // colour 2 piece at progress 0 sits on abs 26 (its start, safe); at progress 2 on abs 28
    const t: Table = {
      colours: [0, 2],
      pieces: [
        [24, 22, -1, -1],
        [2, 0, -1, -1],
      ],
    };
    const steps = legalSteps(t, 0, 4);
    expect(steps.find((s) => s.piece === 0)!.captures).toEqual([[1, 0]]);
    expect(steps.find((s) => s.piece === 1)!.captures).toEqual([]);
    expect(SAFE.has(absOf(2, 0))).toBe(true);
    const after = applyStep(
      t,
      0,
      steps.find((s) => s.piece === 0)!,
    );
    expect(after.pieces[1][0]).toBe(-1);
  });

  it("knows when a piece is in range of a rival", () => {
    const t: Table = {
      colours: [0, 2],
      pieces: [
        [30, -1, -1, -1],
        [0, -1, -1, -1],
      ],
    };
    // colour 2 progress 0 = abs 26; colour 0 progress 30 = abs 30, four ahead
    expect(threatened(t, 0, absOf(0, 30))).toBe(true);
    expect(threatened(t, 0, absOf(0, 40))).toBe(false);
    expect(threatened(t, 0, -1)).toBe(false);
    expect(threatened(t, 0, 8)).toBe(false);
  });
});

describe("ludo puzzles", { timeout: 60_000 }, () => {
  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a deterministic ${d} decision with one clear best move`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(generate(createRng(`daily:2026-11-02:${d}`), d)).toEqual(a);
      expect(countSolutions(a.puzzle, 3)).toBe(1);
      const r = ranked(a.puzzle);
      expect(r[0].score - r[1].score).toBeGreaterThanOrEqual(MARGIN);
      expect(a.puzzle.names[0]).toBe("You");
    });
  }

  it("has one answer over 25 seeds", () => {
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), (["easy", "medium", "hard", "expert", "mega"] as const)[i % 5]);
      expect(countSolutions(g.puzzle)).toBe(1);
      expect(verify(g.puzzle, g.solution, { piece: g.solution.piece }).ok).toBe(true);
    }
  });

  it("scores captures over running, and punishes walking into range", () => {
    const p: LudoPuzzle = {
      table: {
        colours: [0, 2],
        pieces: [
          [24, 3, -1, -1],
          [2, -1, -1, -1],
        ],
      },
      roll: 4,
      names: ["You", "Kofi"],
    };
    const r = ranked(p);
    expect(r[0].step.piece).toBe(0);
    expect(r[0].reasons).toContain("capture");
    expect(explain(r[0])).toMatch(/sends a rival back/);
    const home = scoreStep(
      {
        colours: [0, 2],
        pieces: [
          [53, -1, -1, -1],
          [-1, -1, -1, -1],
        ],
      },
      0,
      legalSteps(
        {
          colours: [0, 2],
          pieces: [
            [53, -1, -1, -1],
            [-1, -1, -1, -1],
          ],
        },
        0,
        3,
      )[0],
    );
    expect(home.reasons).toContain("home");
    const exposedT: Table = {
      colours: [0, 2],
      pieces: [
        [14, -1, -1, -1],
        [41, -1, -1, -1],
      ],
    };
    const ex = scoreStep(
      exposedT,
      0,
      legalSteps(exposedT, 0, 6).find((s) => s.piece === 0)!,
    );
    expect(ex.reasons).toContain("exposed");
    const lone: Table = {
      colours: [0, 2],
      pieces: [
        [14, -1, -1, -1],
        [-1, -1, -1, -1],
      ],
    };
    const plain = scoreStep(lone, 0, legalSteps(lone, 0, 2)[0]);
    expect(plain.reasons).toContain("progress");
    expect(explain({ step: ex.step, score: 0, reasons: ["progress"] })).toMatch(/out of range/);
  });

  it("verifies the answer and rejects others and junk", () => {
    const g = generate(createRng("verify"), "hard");
    expect(verify(g.puzzle, g.solution, { piece: g.solution.piece })).toEqual({ ok: true, progress: 1 });
    const other = ranked(g.puzzle)[1].step.piece;
    expect(verify(g.puzzle, g.solution, { piece: other }).reason).toBe("not the best move");
    expect(verify(g.puzzle, g.solution, { piece: 9 }).reason).toBe("piece cannot move");
    expect(verify(g.puzzle, g.solution, { piece: null }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, "x" as never).ok).toBe(false);
    expect(logic.progress(g.puzzle, g.solution, { piece: g.solution.piece })).toBe(1);
    expect(
      countSolutions({
        table: {
          colours: [0, 2],
          pieces: [
            [-1, -1, -1, -1],
            [-1, -1, -1, -1],
          ],
        },
        roll: 3,
        names: [],
      }),
    ).toBe(0);
  });

  it("hints explain the idea and point at the piece", () => {
    for (let i = 0; i < 6; i++) {
      const g = generate(createRng(`hint${i}`), "expert");
      const h = hint(g.puzzle, g.solution, { piece: null });
      expect(h?.target).toBe(g.solution.piece);
      expect(h?.text.length).toBeGreaterThan(10);
      expect(hint(g.puzzle, g.solution, { piece: g.solution.piece })).toBeNull();
    }
  });

  it("grades harder days higher", () => {
    const avg = (d: Difficulty) => [0, 1, 2, 3].reduce((s, i) => s + generate(createRng(`g${i}`), d).grade, 0) / 4;
    expect(avg("easy")).toBeLessThan(avg("medium"));
    expect(avg("medium")).toBeLessThan(avg("expert"));
    expect(grade(generate(createRng("x"), "easy").puzzle)).toBeLessThan(70);
  });
});

describe("ludo match rules", () => {
  it("supports 2 to 4 seats with distinct shaped colours", () => {
    const r = createRng("m");
    expect(ludoRules.initial(2, r).colours).toEqual([0, 2]);
    expect(ludoRules.initial(4, r).colours).toEqual([0, 1, 2, 3]);
    expect(() => ludoRules.initial(5, r)).toThrow();
    expect(ludoRules.seats).toEqual({ min: 2, max: 4 });
  });

  it("rolls on the server, passes without a 6, brings a piece out on a 6 and rolls again", () => {
    let s = ludoRules.initial(3, createRng("x"));
    expect(ludoRules.legalMoves(s, 0)).toEqual([{ kind: "roll" }]);
    expect(ludoRules.legalMoves(s, 1)).toEqual([]);
    expect(() => ludoRules.apply(s, 1, { kind: "roll" }, createRng("x"))).toThrow();
    s = ludoRules.apply(s, 0, { kind: "roll" }, fixed([3]));
    expect(s.turn).toBe(1);
    s = ludoRules.apply(s, 1, { kind: "roll" }, fixed([6]));
    expect(s.roll).toBe(6);
    expect(ludoRules.isLegal(s, 1, { kind: "move", piece: 2 })).toBe(true);
    expect(ludoRules.isLegal(s, 1, { kind: "roll" })).toBe(false);
    expect(ludoRules.isLegal(s, 1, null as never)).toBe(false);
    s = ludoRules.apply(s, 1, { kind: "move", piece: 2 }, fixed([1]));
    expect(s.pieces[1][2]).toBe(0);
    expect(s.turn).toBe(1); // a 6 rolls again
    expect(s.log.at(-1)).toEqual({ seat: 1, roll: 6, piece: 2 });
    s = ludoRules.apply(s, 1, { kind: "roll" }, fixed([2]));
    s = ludoRules.apply(s, 1, { kind: "move", piece: 2 }, fixed([1]));
    expect(s.turn).toBe(2);
  });

  it("ends the turn on a third 6", () => {
    const s: LudoMatch = {
      colours: [0, 2],
      pieces: [
        [5, -1, -1, -1],
        [-1, -1, -1, -1],
      ],
      turn: 0,
      roll: null,
      sixes: 2,
      log: [],
    };
    const t = ludoRules.apply(s, 0, { kind: "roll" }, fixed([6]));
    expect(t.turn).toBe(1);
    expect(t.sixes).toBe(0);
  });

  it("captures earn another roll, and four home wins", () => {
    const s: LudoMatch = {
      colours: [0, 2],
      pieces: [
        [24, HOME, HOME, HOME],
        [2, -1, -1, -1],
      ],
      turn: 0,
      roll: 4,
      sixes: 0,
      log: [{ seat: 0, roll: 4, piece: null }],
    };
    const t = ludoRules.apply(s, 0, { kind: "move", piece: 0 }, fixed([1]));
    expect(t.pieces[1][0]).toBe(-1);
    expect(t.turn).toBe(0);
    const w: LudoMatch = {
      ...s,
      pieces: [
        [53, HOME, HOME, HOME],
        [2, -1, -1, -1],
      ],
      roll: 3,
    };
    const u = ludoRules.apply(w, 0, { kind: "move", piece: 0 }, fixed([1]));
    expect(ludoRules.status(u)).toEqual({ over: true, winner: 0, reason: "all four home" });
    expect(ludoRules.legalMoves(u, 0)).toEqual([]);
  });

  it("practice bots finish a 4-player game with legal moves", () => {
    const r = createRng("bot");
    let s = ludoRules.initial(4, r);
    for (let i = 0; i < 6000 && !ludoRules.status(s).over; i++) {
      const seat = ludoRules.turn(s);
      const m = ludoRules.botMove!(s, seat, r);
      expect(ludoRules.isLegal(s, seat, m)).toBe(true);
      s = ludoRules.apply(s, seat, m, r);
    }
    expect(ludoRules.status(s).over).toBe(true);
    expect(() => ludoRules.botMove!(s, (s.turn + 1) % 4, r)).toThrow();
  });
});
