import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  GOAL_FOR,
  countSolutions,
  defence,
  generate,
  hint,
  progress,
  replay,
  safeTakes,
  verify,
  type DaraPuzzle,
  type DaraSolution,
  type PuzzleMove,
} from "./logic";
import { makesThree, steps } from "./rules";

const DS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const st = (moves: PuzzleMove[]) => ({ moves });

/** The winning line: the first step, their reply, then a three (with a stone to take). */
function solveLine(p: DaraPuzzle, sol: DaraSolution): PuzzleMove[] {
  const take = (b: number[]) => (sol.takes.length ? sol.takes[0] : b.findIndex((v) => v === 2));
  if (p.goal !== "three2") {
    const b = p.board.slice();
    b[sol.to] = 1;
    b[sol.from] = 0;
    return [{ from: sol.from, to: sol.to, take: take(b) }];
  }
  const first = { from: sol.from, to: sol.to };
  const r = replay(p, [first]);
  const fin = steps(r.board, 1).find((s) => s.three)!;
  const b = r.board.slice();
  b[fin.to] = 1;
  b[fin.from] = 0;
  return [first, { from: fin.from, to: fin.to, take: b.findIndex((v) => v === 2) }];
}

describe("dara puzzles", () => {
  it("has the right goal per difficulty", () => {
    expect(logic.id).toBe("dara");
    expect(GOAL_FOR).toMatchObject({ easy: "capture", medium: "block", hard: "three2" });
  });

  for (const d of DS)
    it(`${d}: 25 seeds are unique, verify the solution, reject wrong lines and give safe hints`, () => {
      for (let i = 0; i < 25; i++) {
        const g = generate(createRng(`dara:${d}:${i}`), d);
        const { puzzle: p, solution: sol } = g;
        expect(p.board).toHaveLength(30);
        expect(countSolutions(p, 2)).toBe(1);
        if (i < 3) expect(generate(createRng(`dara:${d}:${i}`), d)).toEqual(g);
        const line = solveLine(p, sol);
        expect(verify(p, sol, st(line))).toEqual({ ok: true, progress: 1 });
        expect(progress(p, sol, st(line))).toBe(1);
        expect(hint(p, sol, st(line))).toBeNull();
        // nothing played, a wrong first step, a missing take
        expect(verify(p, sol, st([])).ok).toBe(false);
        const other = steps(p.board, 1).find((s) => s.from !== sol.from || s.to !== sol.to);
        if (other) expect(verify(p, sol, st([{ from: other.from, to: other.to, take: line.at(-1)!.take }])).ok).toBe(false);
        expect(verify(p, sol, st(line.map((m, k) => (k === line.length - 1 ? { from: m.from, to: m.to } : m)))).ok).toBe(false);
        // the first hint points at the stone that moves
        const h = hint(p, sol, st([]))!;
        expect(h.target).toBe(sol.from);
        expect(h.text).toMatch(/row \d, column \d/);
        if (p.goal === "three2") {
          // no three now; after the step, their best defence still leaves one, and the hint finds it
          expect(steps(p.board, 1).some((s) => s.three)).toBe(false);
          const after = replay(p, [line[0]]);
          expect(after.replies).toHaveLength(1);
          expect(progress(p, sol, st([line[0]]))).toBe(0.5);
          const h2 = hint(p, sol, st([line[0]]))!;
          const tgt = h2.target as number;
          expect(steps(after.board, 1).some((s) => s.from === tgt && s.three)).toBe(true);
        } else {
          expect(makesThree(p.board, sol.from, sol.to, 1)).toBe(true);
        }
        if (p.goal === "block") {
          // a take that leaves them a three is refused
          const b = p.board.slice();
          b[sol.to] = 1;
          b[sol.from] = 0;
          const bad = b.findIndex((v, x) => v === 2 && !safeTakes(b).includes(x));
          expect(bad).toBeGreaterThanOrEqual(0);
          expect(verify(p, sol, st([{ from: sol.from, to: sol.to, take: bad }])).ok).toBe(false);
          expect(hint(p, sol, st([{ from: sol.from, to: sol.to, take: bad }]))?.text).toMatch(/Undo/);
        }
      }
    });

  it("rejects malformed states", () => {
    const g = generate(createRng("m"), "easy");
    expect(verify(g.puzzle, g.solution, { moves: "x" } as never).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, st([{ from: -1, to: 99 }])).ok).toBe(false);
    expect(progress(g.puzzle, g.solution, null as never)).toBe(0);
  });

  it("defence picks the reply that leaves the fewest threes", () => {
    const g = generate(createRng("def"), "hard");
    const r = replay(g.puzzle, [{ from: g.solution.from, to: g.solution.to }]);
    expect(r.wrongAt).toBe(-1);
    const b = g.puzzle.board.slice();
    b[g.solution.to] = 1;
    b[g.solution.from] = 0;
    expect(defence(b)).toEqual(r.replies[0]);
  });
});
