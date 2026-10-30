import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import logic, { analyze, countSolutions, endpoints, generate, grade, hint, pairCount, SHAPE_FOR, solveAll, verify, type PairupPuzzle } from "./logic";
import type { Difficulty } from "@/games/types";
import { adjacent } from "@/games/_shared/grid";

/** 3x3 with one pair per row: the only fill is three straight lines */
const tiny: PairupPuzzle = { size: 3, dots: [1, 0, 1, 2, 0, 2, 3, 0, 3] };
/** 3x3 with two fills: 1 straight along the top, or 1 dipping into the middle row */
const twin: PairupPuzzle = { size: 3, dots: [1, 0, 1, 2, 0, 0, 0, 0, 2] };

describe("pairup", () => {
  it("finds dots and analyses lines", () => {
    expect(pairCount(tiny)).toBe(3);
    expect(endpoints(tiny)).toEqual([
      [0, 2],
      [3, 5],
      [6, 8],
    ]);
    const good = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
    ];
    expect(analyze(tiny, good).complete).toBe(true);
    expect(analyze(tiny, [[2, 1, 0], [], []]).connected.has(1)).toBe(true);
    expect(analyze(tiny, [[1, 2], [], []]).error).toBe("line does not start on its dot");
    expect(analyze(tiny, [[0, 4], [], []]).error).toBe("line jumps");
    expect(analyze(tiny, [[0, 3], [], []]).error).toBe("lines overlap");
    expect(analyze(twin, [[0, 1, 2, 5], []]).error).toBe("line runs through its dot");
    expect(analyze(tiny, [[0, 1, 4, 3], [], []]).error).toBe("lines overlap");
    expect(analyze(tiny, [[], [3, 4, 7, 4], []]).error).toBe("line crosses itself");
    expect(analyze(tiny, [[], [3, 4, 3], []]).error).toBe("line crosses itself");
    const partial = analyze(tiny, [[0, 1, 2], [3, 4], []]);
    expect(partial.complete).toBe(false);
    expect(partial.filled).toBe(8);
  });

  it("solver counts every solution and respects the budget", () => {
    expect(solveAll(tiny, 5).solutions).toEqual([
      [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ],
    ]);
    expect(countSolutions(twin, 5)).toBe(2);
    // two pairs in opposite corners of an open 3x3 can be routed several ways or not at all
    const open: PairupPuzzle = { size: 3, dots: [1, 0, 2, 0, 0, 0, 2, 0, 1] };
    expect(countSolutions(open, 5)).toBe(0);
    // a 2x3 band: 1 . 1 / 2 . 2 has exactly one fill
    expect(countSolutions({ size: 2, dots: [1, 1, 2, 2] }, 5)).toBe(1);
    const loose: PairupPuzzle = { size: 4, dots: [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    expect(countSolutions(loose, 2)).toBe(2);
    expect(solveAll(loose, 5, 1).exhausted).toBe(true);
    expect(countSolutions(loose, 1)).toBe(1);
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates unique ${d} puzzles deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.size).toBe(SHAPE_FOR[d].size);
      expect(Math.abs(pairCount(a.puzzle) - SHAPE_FOR[d].pairs)).toBeLessThanOrEqual(2);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(analyze(a.puzzle, a.solution).complete).toBe(true);
      for (const l of a.solution) {
        expect(l.length).toBeGreaterThanOrEqual(3);
        for (let s = 1; s < l.length; s++) expect(adjacent(a.puzzle.size, l[s - 1], l[s])).toBe(true);
      }
    }, 30000);
  }

  it("generates unique boards across 24 seeds", () => {
    for (let i = 0; i < 24; i++) {
      const g = generate(createRng(`free:${i}`), (["easy", "medium", "hard"] as const)[i % 3]);
      expect(countSolutions(g.puzzle, 2)).toBe(1);
    }
  }, 60000);

  it("verifies the solution and rejects near misses and malformed input", () => {
    const { puzzle, solution } = generate(createRng("pairup:verify"), "medium");
    expect(verify(puzzle, solution, solution)).toEqual({ ok: true, progress: 1 });
    // either direction is fine
    expect(verify(puzzle, solution, solution.map((l) => l.slice().reverse())).ok).toBe(true);
    const short = solution.map((l, k) => (k === 0 ? l.slice(0, -1) : l));
    expect(verify(puzzle, solution, short).reason).toBe("incomplete");
    expect(verify(puzzle, solution, [[1]]).reason).toBe("malformed state");
    expect(verify(puzzle, solution, solution.map(() => [-1])).ok).toBe(false);
    expect(verify(puzzle, solution, "x" as unknown as number[][]).ok).toBe(false);
    const jump = solution.map((l, k) => (k === 0 ? [l[0], l[l.length - 1]] : l));
    expect(verify(puzzle, solution, jump).ok).toBe(false);
    const [a1, a2] = solveAll(twin, 2).solutions;
    expect(verify(twin, a1, a2).reason).toBe("valid but not the scheduled solution");
  });

  it("progress counts correct non-dot cells only", () => {
    const { puzzle, solution } = generate(createRng("pairup:progress"), "easy");
    expect(logic.progress(puzzle, solution, solution)).toBe(1);
    expect(logic.progress(puzzle, solution, solution.map(() => []))).toBe(0);
    expect(logic.progress(puzzle, solution, "x" as unknown as number[][])).toBe(0);
    const half = solution.map((l, k) => (k === 0 ? l.slice(0, 2) : []));
    expect(logic.progress(puzzle, solution, half)).toBeGreaterThan(0);
  });

  it("hints are safe: following them always reaches the solution", () => {
    const { puzzle, solution } = generate(createRng("pairup:hints"), "hard");
    let s: number[][] = solution.map(() => []);
    expect(hint(puzzle, solution, s)?.text).toMatch(/^Start line/);
    // a wrong cell is pointed at
    const l0 = solution[0];
    const wrong = solution.map((_, k) => (k === 0 ? [l0[0], l0[2]] : []));
    expect(hint(puzzle, solution, wrong)?.target).toBe(l0[2]);
    expect(hint(puzzle, solution, "x" as unknown as number[][])?.target).toBeDefined();
    for (let step = 0; step < puzzle.size * puzzle.size + 2 && !verify(puzzle, solution, s).ok; step++) {
      const h = hint(puzzle, solution, s)!;
      const t = h.target as number;
      const k = solution.findIndex((l) => l.includes(t));
      expect(k).toBeGreaterThanOrEqual(0);
      s = s.map((l, j) => (j === k ? [...l, t] : l));
      expect(analyze(puzzle, s).error).toBeNull();
    }
    expect(verify(puzzle, solution, s).ok).toBe(true);
    expect(hint(puzzle, solution, s)).toBeNull();
    // drawn from the far dot also works
    const rev = solution.map((l) => [l[l.length - 1]]);
    expect(hint(puzzle, solution, rev)?.text).toMatch(/continues/);
  });

  it("grades larger boards as harder", () => {
    const e = generate(createRng("g1"), "easy");
    const h = generate(createRng("g1"), "hard");
    const x = generate(createRng("g1"), "expert");
    expect(h.grade).toBeGreaterThan(e.grade);
    expect(x.grade).toBeGreaterThan(h.grade);
    expect(grade(e.puzzle)).toBe(e.grade);
    expect(x.grade).toBeLessThanOrEqual(100);
  });
});
