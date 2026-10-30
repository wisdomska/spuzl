import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import logic, { analyze, countSolutions, generate, grade, hint, masksOf, orientations, rotate, SHAPE_FOR, solveAll, turnsTo, verify, type FlowlinePuzzle } from "./logic";
import type { Difficulty } from "@/games/types";

/** state that turns every dealt tile into the solution */
const solvedState = (p: FlowlinePuzzle, sol: number[]) => p.tiles.map((t, i) => turnsTo(t, sol[i]));

describe("flowline", () => {
  it("rotates masks clockwise and lists distinct orientations", () => {
    expect(rotate(1, 1)).toBe(2); // N -> E
    expect(rotate(8, 1)).toBe(1); // W -> N
    expect(rotate(3, 2)).toBe(12); // NE -> SW
    expect(rotate(5, -1)).toBe(10);
    expect(orientations(5).sort((a, b) => a - b)).toEqual([5, 10]);
    expect(orientations(15)).toEqual([15]);
    expect(orientations(1).length).toBe(4);
    expect(turnsTo(1, 4)).toBe(2);
    expect(turnsTo(5, 3)).toBe(-1);
  });

  it("analyses water, leaks and plants", () => {
    // 1 x 3: source in the middle (E+W), plants at both ends
    const p: FlowlinePuzzle = { rows: 1, cols: 3, tiles: [2, 10, 8], source: 1, plants: [0, 2], locked: [] };
    const ok = analyze(p, [2, 10, 8]);
    expect(ok.solved).toBe(true);
    expect(ok.plantsLit).toBe(2);
    expect(ok.dist.get(0)).toBe(1);
    const bad = analyze(p, [1, 10, 8]);
    expect(bad.solved).toBe(false);
    expect(bad.leaks.has(0)).toBe(true);
    expect(bad.leaks.has(1)).toBe(true);
    expect(bad.lit.has(0)).toBe(false);
  });

  it("solver finds every layout of a small board", () => {
    // a 3x3 tree whose tiles admit exactly two layouts (checked against brute force over all 4^9 turns)
    const p: FlowlinePuzzle = { rows: 3, cols: 3, tiles: [4, 6, 8, 3, 15, 12, 2, 9, 1], source: 0, plants: [], locked: [] };
    const { solutions } = solveAll(p, 10);
    expect(solutions.length).toBe(2);
    for (const s of solutions) expect(analyze(p, s).solved).toBe(true);
    expect(countSolutions(p, 1)).toBe(1);
    expect(countSolutions(p, 10)).toBe(2);
    expect(solveAll(p, 10, 1).exhausted).toBe(true);
    expect(countSolutions({ ...p, tiles: p.tiles }, 2)).toBe(2);
    // locking a tile where the layouts differ makes it unique
    const k = solutions[0].findIndex((m, i) => m !== solutions[1][i]);
    expect(countSolutions({ ...p, tiles: p.tiles.map((t, i) => (i === k ? solutions[0][i] : t)), locked: [k] }, 10)).toBe(1);
    // no tree: four dead ends, or four bends that can only make a loop
    expect(countSolutions({ rows: 2, cols: 2, tiles: [1, 1, 1, 1], source: 0, plants: [], locked: [] }, 5)).toBe(0);
    expect(countSolutions({ rows: 2, cols: 2, tiles: [3, 3, 3, 3], source: 0, plants: [], locked: [] }, 5)).toBe(0);
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates unique ${d} puzzles deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.rows).toBe(SHAPE_FOR[d].rows);
      expect(a.puzzle.cols).toBe(SHAPE_FOR[d].cols);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(analyze(a.puzzle, a.solution).solved).toBe(true);
      for (const i of a.puzzle.plants) expect(a.solution[i].toString(2).replace(/0/g, "").length).toBe(1);
      // the deal is scrambled: it does not start solved
      expect(analyze(a.puzzle, a.puzzle.tiles).solved).toBe(false);
    });
  }

  it("generates unique boards across 30 seeds", () => {
    for (let i = 0; i < 30; i++) {
      const g = generate(createRng(`free:${i}`), (["easy", "medium", "hard"] as const)[i % 3]);
      expect(countSolutions(g.puzzle, 2)).toBe(1);
    }
  });

  it("repairs ambiguous deals with locked tiles", () => {
    // across many seeds at least the generator never returns an ambiguous puzzle, and locks show solved tiles
    for (let i = 0; i < 40; i++) {
      const g = generate(createRng(`lock:${i}`), "mega");
      for (const k of g.puzzle.locked) expect(g.puzzle.tiles[k]).toBe(g.solution[k]);
    }
  });

  it("verifies the solution and rejects near misses and malformed input", () => {
    const { puzzle, solution } = generate(createRng("flow:verify"), "easy");
    const good = solvedState(puzzle, solution);
    expect(verify(puzzle, solution, good)).toEqual({ ok: true, progress: 1 });
    // extra full turns are fine for symmetric tiles only when the mask still matches
    const near = good.slice();
    const k = puzzle.tiles.findIndex((t, i) => orientations(t).length === 4 && !puzzle.locked.includes(i));
    near[k] = (near[k] + 1) % 4;
    expect(verify(puzzle, solution, near).ok).toBe(false);
    expect(verify(puzzle, solution, near).reason).toBe("open ends");
    expect(verify(puzzle, solution, [1, 2]).reason).toBe("malformed state");
    expect(verify(puzzle, solution, good.map(() => 7)).ok).toBe(false);
    expect(verify(puzzle, solution, null as unknown as number[]).ok).toBe(false);
    if (puzzle.locked.length) {
      const turned = good.slice();
      turned[puzzle.locked[0]] = 1;
      expect(verify(puzzle, solution, turned).ok).toBe(false);
    }
    // tampered: a locked tile that does not match its dealt mask is rejected
    const tampered = { ...puzzle, locked: [k] };
    expect(verify(tampered, solution, good).reason).toBe("locked tile turned");
    // a valid layout that differs from the scheduled one is rejected
    const tiny: FlowlinePuzzle = { rows: 3, cols: 3, tiles: [4, 6, 8, 3, 15, 12, 2, 9, 1], source: 0, plants: [], locked: [] };
    const [s1, s2] = solveAll(tiny, 2).solutions;
    const st2 = tiny.tiles.map((t, i) => turnsTo(t, s2[i]));
    expect(verify(tiny, s1, st2).reason).toBe("valid but not the scheduled solution");
    // not connected: a ring piece cut off from the source
    expect(verify(tiny, s1, new Array(9).fill(0)).ok).toBe(false);
  });

  it("progress counts tiles in place without positions", () => {
    const { puzzle, solution } = generate(createRng("flow:progress"), "easy");
    const good = solvedState(puzzle, solution);
    expect(logic.progress(puzzle, solution, good)).toBe(1);
    expect(logic.progress(puzzle, solution, "x" as unknown as number[])).toBe(0);
    const zero = new Array(good.length).fill(0);
    expect(logic.progress(puzzle, solution, zero)).toBeLessThan(1);
    const allLocked = { ...puzzle, tiles: solution.slice(), locked: puzzle.tiles.map((_, i) => i) };
    expect(logic.progress(allLocked, solution, zero)).toBe(1);
  });

  it("hints are safe: following them always reaches the solution", () => {
    const { puzzle, solution } = generate(createRng("flow:hints"), "medium");
    let s = new Array(puzzle.tiles.length).fill(0);
    for (let k = 0; k < s.length + 2 && !verify(puzzle, solution, s).ok; k++) {
      const h = hint(puzzle, solution, s)!;
      const i = h.target as number;
      expect(puzzle.locked.includes(i)).toBe(false);
      expect(h.text).toMatch(/^Turn this pipe to open /);
      s = s.slice();
      s[i] = turnsTo(puzzle.tiles[i], solution[i]);
      expect(masksOf(puzzle, s)[i]).toBe(solution[i]);
    }
    expect(verify(puzzle, solution, s).ok).toBe(true);
    expect(hint(puzzle, solution, s)).toBeNull();
    expect(hint(puzzle, solution, "bad" as unknown as number[])).not.toBeNull();
  });

  it("grades larger boards as harder", () => {
    const e = generate(createRng("g1"), "easy");
    const m = generate(createRng("g1"), "medium");
    const x = generate(createRng("g1"), "expert");
    const mega = generate(createRng("g1"), "mega");
    expect(x.grade).toBeGreaterThan(e.grade);
    expect(mega.grade).toBeGreaterThan(m.grade);
    expect(grade(e.puzzle, e.solution)).toBe(e.grade);
    expect(grade(e.puzzle)).toBeGreaterThanOrEqual(0);
    expect(mega.grade).toBeLessThanOrEqual(100);
  });
});
