import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import {
  EMPTY, KING0, KING1, MAN0, MAN1, applyMove, capturesFrom, count, findMove, initialBoard, legalMoves, notation, simpleFrom, squareNumber, type Board,
} from "./engine";
import logic, { JUMPS_FOR, countSolutions, generate, grade, hint, verify, winningMoves } from "./logic";
import draughtsRules, { QUIET_LIMIT, type DraughtsMatch } from "./rules";

const sq = (r: number, c: number) => r * 8 + c;
const empty = (): Board => new Array(64).fill(EMPTY);

describe("draughts engine (English rules)", () => {
  it("sets up 12 men each on the dark squares", () => {
    const b = initialBoard();
    expect(count(b, 0)).toBe(12);
    expect(count(b, 1)).toBe(12);
    expect(legalMoves(b, 0)).toHaveLength(7);
    expect(squareNumber(1)).toBe(1);
    expect(squareNumber(62)).toBe(32);
  });

  it("men move forward only, kings both ways", () => {
    const b = empty();
    b[sq(4, 3)] = MAN0;
    expect(simpleFrom(b, sq(4, 3)).map((m) => m.path[1]).sort()).toEqual([sq(3, 2), sq(3, 4)]);
    b[sq(4, 3)] = KING0;
    expect(simpleFrom(b, sq(4, 3))).toHaveLength(4);
    b[sq(4, 3)] = MAN1;
    expect(simpleFrom(b, sq(4, 3)).every((m) => m.path[1] >> 3 === 5)).toBe(true);
    expect(simpleFrom(b, sq(0, 0))).toEqual([]);
  });

  it("makes captures compulsory and chains multiple jumps", () => {
    const b = empty();
    b[sq(6, 1)] = MAN0;
    b[sq(5, 2)] = MAN1;
    b[sq(3, 4)] = MAN1;
    b[sq(7, 6)] = MAN0;
    const moves = legalMoves(b, 0);
    expect(moves).toHaveLength(1);
    expect(moves[0].path).toEqual([sq(6, 1), sq(4, 3), sq(2, 5)]);
    expect(moves[0].caps).toEqual([sq(5, 2), sq(3, 4)]);
    expect(notation(moves[0])).toBe("25x18x11");
    const after = applyMove(b, moves[0]);
    expect(count(after, 1)).toBe(0);
  });

  it("crowns a man and ends the sequence there", () => {
    const b = empty();
    b[sq(2, 1)] = MAN0;
    b[sq(1, 2)] = MAN1;
    b[sq(1, 4)] = MAN1; // would be jumpable by a king from (0,3), but the move stops on crowning
    const [m] = capturesFrom(b, sq(2, 1));
    expect(m.path).toEqual([sq(2, 1), sq(0, 3)]);
    expect(m.crowns).toBe(true);
    expect(applyMove(b, m)[sq(0, 3)]).toBe(KING0);
    const s = empty();
    s[sq(1, 2)] = MAN0;
    expect(simpleFrom(s, sq(1, 2))[0].crowns).toBe(true);
  });

  it("kings capture backwards and never jump a piece twice", () => {
    const b = empty();
    b[sq(3, 2)] = KING0;
    b[sq(4, 3)] = MAN1;
    b[sq(4, 5)] = MAN1;
    b[sq(2, 5)] = MAN1;
    b[sq(2, 3)] = MAN1;
    const caps = capturesFrom(b, sq(3, 2));
    expect(Math.max(...caps.map((m) => m.caps.length))).toBe(4);
    for (const m of caps) expect(new Set(m.caps).size).toBe(m.caps.length);
  });

  it("finds moves by exact path and rejects junk", () => {
    const b = initialBoard();
    const m = legalMoves(b, 0)[0];
    expect(findMove(b, 0, m.path)).toEqual(m);
    expect(findMove(b, 0, [m.path[0]])).toBeNull();
    expect(findMove(b, 0, "x")).toBeNull();
    expect(findMove(b, 0, [1.5, 2])).toBeNull();
    expect(capturesFrom(b, 0)).toEqual([]);
    expect(simpleFrom(b, 0)).toEqual([]);
  });
});

describe("draughts puzzles", { timeout: 60_000 }, () => {
  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a deterministic, unique ${d} chain of ${JUMPS_FOR[d]}`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(generate(createRng(`daily:2026-11-02:${d}`), d)).toEqual(a);
      expect(countSolutions(a.puzzle, 3)).toBe(1);
      expect(a.solution.path).toHaveLength(JUMPS_FOR[d] + 1);
      expect(count(a.puzzle.board, 1)).toBe(JUMPS_FOR[d]);
    });
  }

  it("generates unique puzzles over 25 seeds", () => {
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), (["easy", "medium", "hard"] as const)[i % 3]);
      expect(countSolutions(g.puzzle, 2)).toBe(1);
      expect(winningMoves(g.puzzle)[0].path).toEqual(g.solution.path);
      expect(verify(g.puzzle, g.solution, { path: g.solution.path }).ok).toBe(true);
    }
  });

  it("verifies the solution and rejects near misses and malformed input", () => {
    const g = generate(createRng("verify"), "hard");
    expect(verify(g.puzzle, g.solution, { path: g.solution.path })).toEqual({ ok: true, progress: 1 });
    expect(verify(g.puzzle, g.solution, { path: g.solution.path.slice(0, -1) }).ok).toBe(false);
    const other = legalMoves(g.puzzle.board, 0).find((m) => m.path.join() !== g.solution.path.join());
    if (other) expect(verify(g.puzzle, g.solution, { path: other.path }).reason).toBe("rival pieces left");
    expect(verify(g.puzzle, g.solution, { path: [1, "a"] } as never).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as never).ok).toBe(false);
    // a valid clearing chain that is not the scheduled one means tampered data
    expect(verify(g.puzzle, { path: [...g.solution.path].reverse() }, { path: g.solution.path }).ok).toBe(false);
  });

  it("reports progress as matched landings only", () => {
    const g = generate(createRng("progress"), "medium");
    const p = g.solution.path;
    expect(logic.progress(g.puzzle, g.solution, { path: [] })).toBe(0);
    expect(logic.progress(g.puzzle, g.solution, { path: p.slice(0, 2) })).toBeCloseTo(1 / (p.length - 1));
    expect(logic.progress(g.puzzle, g.solution, { path: p })).toBe(1);
    expect(logic.progress(g.puzzle, g.solution, 3 as never)).toBe(0);
  });

  it("hints are safe: following them builds the solution", () => {
    const g = generate(createRng("hints"), "expert");
    const path: number[] = [];
    for (;;) {
      const h = hint(g.puzzle, g.solution, { path });
      if (!h) break;
      path.push(h.target as number);
    }
    expect(verify(g.puzzle, g.solution, { path }).ok).toBe(true);
    const wrong = [g.solution.path[0], (g.solution.path[1] + 2) % 64];
    expect(hint(g.puzzle, g.solution, { path: wrong })?.target).toBe(g.solution.path[0]);
    expect(hint(g.puzzle, g.solution, "x" as never)?.target).toBe(g.solution.path[0]);
  });

  it("grades longer chains higher", () => {
    const avg = (d: Difficulty) => [0, 1, 2].reduce((s, i) => s + generate(createRng(`g${i}`), d).grade, 0) / 3;
    const xs = (["easy", "medium", "hard", "expert", "mega"] as Difficulty[]).map(avg);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    expect(grade(generate(createRng("one"), "easy").puzzle)).toBeLessThan(50);
  });
});

describe("draughts match rules", () => {
  it("validates turns and compulsory captures server-side", () => {
    const rng = createRng("m");
    const s = draughtsRules.initial(2, rng);
    expect(draughtsRules.turn(s)).toBe(0);
    expect(draughtsRules.legalMoves(s, 1)).toEqual([]);
    const mv = draughtsRules.legalMoves(s, 0)[0];
    expect(draughtsRules.isLegal(s, 0, mv)).toBe(true);
    expect(draughtsRules.isLegal(s, 1, mv)).toBe(false);
    expect(() => draughtsRules.apply(s, 1, mv, rng)).toThrow();
    expect(() => draughtsRules.apply(s, 0, [0, 9], rng)).toThrow();
    const s2 = draughtsRules.apply(s, 0, mv, rng);
    expect(s2.turn).toBe(1);
    expect(s2.quiet).toBe(1);

    const b = empty();
    b[sq(6, 1)] = MAN0;
    b[sq(5, 2)] = MAN1;
    b[sq(0, 7)] = MAN1;
    const t: DraughtsMatch = { board: b, turn: 0, quiet: 10, moves: [] };
    expect(draughtsRules.legalMoves(t, 0)).toEqual([[sq(6, 1), sq(4, 3)]]);
    expect(draughtsRules.isLegal(t, 0, [sq(6, 1), sq(5, 0)])).toBe(false);
    const t2 = draughtsRules.apply(t, 0, [sq(6, 1), sq(4, 3)], rng);
    expect(t2.quiet).toBe(0);
  });

  it("ends when a side cannot move, and on 40 quiet moves each", () => {
    const b = empty();
    b[sq(4, 3)] = KING0;
    const won: DraughtsMatch = { board: b, turn: 1, quiet: 0, moves: [] };
    expect(draughtsRules.status(won)).toEqual({ over: true, winner: 0, reason: "no pieces left" });
    expect(() => draughtsRules.apply(won, 1, [0, 9], createRng("x"))).toThrow("game over");
    const blocked = empty();
    blocked[sq(0, 1)] = MAN1;
    blocked[sq(1, 0)] = MAN0;
    blocked[sq(2, 1)] = MAN0;
    blocked[sq(1, 2)] = MAN0;
    blocked[sq(2, 3)] = MAN0;
    expect(draughtsRules.status({ board: blocked, turn: 1, quiet: 0, moves: [] }).reason).toBe("no legal moves");
    const d = empty();
    d[sq(4, 3)] = KING0;
    d[sq(0, 1)] = KING1;
    expect(draughtsRules.status({ board: d, turn: 0, quiet: QUIET_LIMIT, moves: [] })).toMatchObject({ over: true, winner: null });
  });

  it("practice bot plays legal moves and takes the longest capture", () => {
    const rng = createRng("bot");
    let s = draughtsRules.initial(2, rng);
    for (let i = 0; i < 40 && !draughtsRules.status(s).over; i++) {
      const seat = draughtsRules.turn(s);
      const m = draughtsRules.botMove!(s, seat, rng);
      expect(draughtsRules.isLegal(s, seat, m)).toBe(true);
      s = draughtsRules.apply(s, seat, m, rng);
    }
    const b = empty();
    b[sq(6, 1)] = MAN0;
    b[sq(5, 2)] = MAN1;
    b[sq(3, 4)] = MAN1;
    b[sq(0, 7)] = MAN1;
    expect(draughtsRules.botMove!({ board: b, turn: 0, quiet: 0, moves: [] }, 0, rng)).toEqual([sq(6, 1), sq(4, 3), sq(2, 5)]);
    expect(() => draughtsRules.botMove!({ board: empty(), turn: 0, quiet: 0, moves: [] }, 0, rng)).toThrow();
  });
});
