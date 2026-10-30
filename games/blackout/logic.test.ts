import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, { generate, grade, hint, lit, minimalPresses, neighbourhood, press, replay, SIZE_FOR, solveSpace, verify } from "./logic";

/** Exhaustive minimum for tiny boards, to check the GF(2) answer. */
function bruteMin(n: number, lights: number[]): number {
  let best = Infinity;
  for (let mask = 0; mask < 1 << (n * n); mask++) {
    let l = lights.slice();
    let k = 0;
    for (let i = 0; i < n * n; i++) if (mask & (1 << i)) {
      l = press(n, l, i);
      k++;
    }
    if (!lit(l)) best = Math.min(best, k);
  }
  return best;
}

describe("blackout", () => {
  it("flips a tile and its orthogonal neighbours", () => {
    expect(neighbourhood(3, 4).sort()).toEqual([1, 3, 4, 5, 7]);
    expect(neighbourhood(3, 0).sort()).toEqual([0, 1, 3]);
    expect(press(3, new Array(9).fill(0), 8)).toEqual([0, 0, 0, 0, 0, 1, 0, 1, 1]);
  });

  it("GF(2) minimum matches brute force on 3x3 and 4x4 boards", () => {
    const rng = createRng("brute");
    for (const n of [3, 4]) {
      for (let t = 0; t < 12; t++) {
        let l = new Array(n * n).fill(0);
        for (let k = 0; k < 5; k++) l = press(n, l, rng.int(0, n * n - 1));
        const min = minimalPresses(n, l)!;
        expect(min.length).toBe(bruteMin(n, l));
        let check = l;
        for (const i of min) check = press(n, check, i);
        expect(lit(check)).toBe(0);
      }
    }
  });

  it("reports unsolvable boards and the 5x5 null space", () => {
    const one = new Array(16).fill(0);
    one[0] = 1;
    expect(solveSpace(4, one)).toBeNull();
    expect(minimalPresses(4, one)).toBeNull();
    expect(solveSpace(5, new Array(25).fill(0))!.basis).toHaveLength(2);
    expect(solveSpace(6, new Array(36).fill(0))!.basis).toHaveLength(0);
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates solvable ${d} boards deterministically with a true par`, () => {
      const a = generate(createRng(`daily:${d}`), d);
      expect(generate(createRng(`daily:${d}`), d)).toEqual(a);
      expect(a.puzzle.size).toBe(SIZE_FOR[d]);
      expect(lit(a.puzzle.lights)).toBeGreaterThan(0);
      expect(a.solution.presses).toHaveLength(a.puzzle.par);
      expect(lit(replay(a.puzzle, a.solution.presses))).toBe(0);
      if (a.puzzle.size === 4) expect(a.puzzle.par).toBe(bruteMin(4, a.puzzle.lights));
    });
  }

  it("generates 20+ solvable boards", () => {
    for (let i = 0; i < 24; i++) {
      const g = generate(createRng(`free:${i}`), (["easy", "medium", "hard"] as const)[i % 3]);
      expect(minimalPresses(g.puzzle.size, g.puzzle.lights)!.length).toBe(g.puzzle.par);
    }
  });

  it("verifies by replaying the tap log and rejects malformed logs", () => {
    const g = generate(createRng("verify"), "medium");
    expect(verify(g.puzzle, g.solution, { presses: g.solution.presses })).toEqual({ ok: true, progress: 1 });
    // Any order, and extra cancelling taps, still clear.
    const extra = [...g.solution.presses].reverse().concat([3, 3]);
    expect(verify(g.puzzle, g.solution, { presses: extra }).ok).toBe(true);
    expect(verify(g.puzzle, g.solution, { presses: g.solution.presses.slice(1) }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { presses: [99] }).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, { presses: [1.5] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as never).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { presses: new Array(3000).fill(0) }).ok).toBe(false);
  });

  it("progress tracks taps still needed", () => {
    const g = generate(createRng("progress"), "hard");
    expect(logic.progress(g.puzzle, g.solution, { presses: [] })).toBe(0);
    const half = g.solution.presses.slice(0, 4);
    expect(logic.progress(g.puzzle, g.solution, { presses: half })).toBeGreaterThan(0);
    expect(logic.progress(g.puzzle, g.solution, { presses: g.solution.presses })).toBe(1);
    expect(logic.progress(g.puzzle, g.solution, { presses: [-1] })).toBe(0);
  });

  it("hints follow a minimal path to lights out", () => {
    const g = generate(createRng("hints"), "expert");
    const s = { presses: [0, 7] };
    const start = minimalPresses(g.puzzle.size, replay(g.puzzle, s.presses))!.length;
    for (let k = 0; k < start; k++) {
      const h = hint(g.puzzle, g.solution, s)!;
      expect(h.text).toMatch(/Tap row/);
      s.presses.push(h.target as number);
    }
    expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
    expect(hint(g.puzzle, g.solution, s)).toBeNull();
    expect(hint(g.puzzle, g.solution, { presses: [999] })).toBeNull();
  });

  it("grades bigger boards and higher par harder", () => {
    const e = generate(createRng("g"), "easy");
    const m = generate(createRng("g"), "mega");
    expect(grade(m.puzzle)).toBeGreaterThan(grade(e.puzzle));
    expect(m.grade).toBeLessThanOrEqual(100);
  });
});
