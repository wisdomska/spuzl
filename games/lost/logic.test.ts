import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import logic, {
  canMove,
  distances,
  generate,
  grade,
  hint,
  maxMoves,
  replay,
  route,
  SIZE_FOR,
  verify,
  visibleFrom,
  type LostPuzzle,
} from "./logic";
import type { Difficulty } from "@/games/types";
import { opposite, step } from "@/games/_shared/grid";

/**
 * 2x2 U maze: 0 - 1
 *                 |
 *             2 - 3   start 0, exit 2 (walls between 0 and 2)
 */
const u: LostPuzzle = { rows: 2, cols: 2, cells: [2, 8 | 4, 2, 1 | 8], start: 0, exit: 2 };

describe("lost", () => {
  it("moves only through open passages and replays logs", () => {
    expect(canMove(u, 0, 1)).toBe(true);
    expect(canMove(u, 0, 2)).toBe(false);
    expect(canMove({ ...u, cells: [1, 0, 0, 0] }, 0, 0)).toBe(false); // off the board
    const r = replay(u, [1, 2, 3]);
    expect(r.at).toBe(2);
    expect(r.path).toEqual([0, 1, 3, 2]);
    expect(r.reachedAt).toBe(3);
    expect(replay(u, [2]).bad).toBe(0);
    expect(replay({ ...u, start: 2 }, []).reachedAt).toBe(0);
    expect(distances(u, 2)).toEqual([3, 2, 0, 1]);
    expect(route(u, 0)).toEqual([1, 2, 3]);
  });

  it("sees two steps through passages and down corridors", () => {
    const v = visibleFrom(u, 0, 1, 0);
    expect(v.sort()).toEqual([0, 1]);
    expect(visibleFrom(u, 0).sort()).toEqual([0, 1, 3]);
    const g = generate(createRng("lost:sight"), "easy").puzzle;
    for (const c of visibleFrom(g, g.start)) expect(distances(g, g.start)[c]).toBeGreaterThanOrEqual(0);
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a perfect ${d} maze deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      const p = a.puzzle;
      expect(p.rows).toBe(SIZE_FOR[d]);
      const N = p.rows * p.cols;
      // every cell reachable, passages symmetric, and a tree (N - 1 passages): one route only
      const dist = distances(p, p.start);
      expect(dist.every((x) => x >= 0)).toBe(true);
      let edges = 0;
      for (let i = 0; i < N; i++) {
        for (let k = 0; k < 4; k++) {
          if (!canMove(p, i, k)) continue;
          edges++;
          expect(canMove(p, step(p.rows, p.cols, i, k), opposite(k))).toBe(true);
        }
      }
      expect(edges / 2).toBe(N - 1);
      expect(dist[p.exit]).toBe(Math.max(...dist));
      expect(a.solution.length).toBe(dist[p.exit]);
      expect(verify(p, a.solution, { moves: a.solution }).ok).toBe(true);
    });
  }

  it("verifies move logs across 20 seeds", () => {
    for (let i = 0; i < 20; i++) {
      const g = generate(createRng(`free:${i}`), "easy");
      expect(verify(g.puzzle, g.solution, { moves: g.solution })).toEqual({ ok: true, progress: 1 });
    }
  });

  it("accepts any legal walk to the exit and rejects forged logs", () => {
    const { puzzle, solution } = generate(createRng("lost:verify"), "medium");
    // a detour out and back is still a legal escape
    const first = solution[0];
    const detour = [first, opposite(first), ...solution];
    expect(verify(puzzle, solution, { moves: detour }).ok).toBe(true);
    expect(verify(puzzle, solution, { moves: solution.slice(0, -1) }).reason).toBe("did not reach the exit");
    const wall = [0, 1, 2, 3].find((k) => !canMove(puzzle, puzzle.start, k))!;
    expect(verify(puzzle, solution, { moves: [wall, ...solution] }).reason).toBe("walked through a wall");
    const last = solution[solution.length - 1];
    expect(verify(puzzle, solution, { moves: [...solution, opposite(last), last] }).reason).toBe("moves after the exit");
    expect(verify(puzzle, solution, { moves: [5] }).reason).toBe("malformed state");
    expect(verify(puzzle, solution, null as unknown as { moves: number[] }).ok).toBe(false);
    expect(verify(puzzle, solution, { moves: "x" } as unknown as { moves: number[] }).ok).toBe(false);
    expect(verify(puzzle, solution, { moves: new Array(maxMoves(puzzle) + 1).fill(0) }).ok).toBe(false);
  });

  it("progress grows as the player nears the exit", () => {
    const { puzzle, solution } = generate(createRng("lost:progress"), "easy");
    expect(logic.progress(puzzle, solution, { moves: [] })).toBe(0);
    const half = logic.progress(puzzle, solution, { moves: solution.slice(0, Math.floor(solution.length / 2)) });
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(logic.progress(puzzle, solution, { moves: solution })).toBe(1);
    expect(logic.progress(puzzle, solution, "x" as unknown as { moves: number[] })).toBe(0);
  });

  it("hints are safe: following them always escapes", () => {
    const { puzzle, solution } = generate(createRng("lost:hints"), "hard");
    const moves: number[] = [];
    let at = puzzle.start;
    expect(hint(puzzle, solution, "x" as unknown as { moves: number[] })?.target).toBe(
      step(puzzle.rows, puzzle.cols, puzzle.start, solution[0]),
    );
    for (let k = 0; k < puzzle.rows * puzzle.cols && at !== puzzle.exit; k++) {
      const h = hint(puzzle, solution, { moves })!;
      const d = [0, 1, 2, 3].find((x) => canMove(puzzle, at, x) && step(puzzle.rows, puzzle.cols, at, x) === h.target)!;
      expect(h.text).toMatch(/^Head (north|east|south|west)\.$/);
      moves.push(d);
      at = h.target as number;
    }
    expect(moves).toEqual(solution);
    expect(hint(puzzle, solution, { moves })).toBeNull();
  });

  it("grades larger mazes as harder", () => {
    const e = generate(createRng("g1"), "easy");
    const h = generate(createRng("g1"), "hard");
    const m = generate(createRng("g1"), "mega");
    expect(h.grade).toBeGreaterThan(e.grade);
    expect(m.grade).toBeGreaterThan(h.grade);
    expect(grade(e.puzzle, e.solution)).toBe(e.grade);
    expect(m.grade).toBeLessThanOrEqual(100);
  });
});
