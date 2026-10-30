import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  cellsOf, complete, countSolutions, fitBreak, generate, grade, hint, normalise, occupancy, rotate, shapeKey, SPEC, verify,
  type Cell, type Placement, type SnugPuzzle, type SnugState,
} from "./logic";

const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
// 2×3 outline, an L tromino and a straight tromino... two L trominoes fit it
const L: Cell[] = [[0, 0], [1, 0], [1, 1]];
const tiny: SnugPuzzle = { rows: 2, cols: 3, outline: [1, 1, 1, 1, 1, 1], pieces: [L, L] };

describe("snug", () => {
  it("rotates and normalises shapes", () => {
    expect(rotate(L, 0)).toEqual(normalise(L));
    expect(rotate(L, 4)).toEqual(rotate(L, 0));
    expect(rotate(L, 1)).toEqual([[0, 0], [0, 1], [1, 0]]);
    expect(rotate(rotate(L, 1), 3)).toEqual(rotate(L, 0));
    expect(shapeKey([[2, 2], [2, 3]])).toBe("0.0|0.1");
    expect(cellsOf(tiny, 0, { r: 0, c: 1, rot: 0 })).toEqual([[0, 1], [1, 1], [1, 2]]);
  });

  it("checks fits: outside, overlap, ok", () => {
    const s: SnugState = [{ r: 0, c: 0, rot: 0 }, null];
    expect(fitBreak(tiny, s, 1, { r: 1, c: 2, rot: 0 })).toBe("outside");
    expect(fitBreak(tiny, s, 1, { r: 0, c: 0, rot: 1 })).toBe("overlap");
    expect(fitBreak(tiny, s, 1, { r: 0, c: 1, rot: 2 })).toBeNull();
    expect(occupancy(tiny, s)).toEqual([0, -1, -1, 0, 0, -1]);
    expect(occupancy(tiny, s, 0)).toEqual(new Array(6).fill(-1));
  });

  it("counts covers, treating equal blocks as interchangeable", () => {
    // two L trominoes tile a 2×3 in exactly two ways (mirror images of each other)
    expect(countSolutions(tiny, 10)).toBe(2);
    const fit = complete(tiny)!;
    expect(verify(tiny, [], fit).ok).toBe(true);
    expect(complete(tiny, [{ r: 0, c: 0, rot: 3 }, null])).toBeNull();
    expect(complete(tiny, [{ r: 5, c: 5, rot: 0 }, null])).toBeNull();
    expect(complete(tiny, [{ r: 0, c: 0, rot: 0 }, { r: 0, c: 0, rot: 0 }])).toBeNull();
  });

  for (const d of diffs) {
    it(`generates ${d} puzzles deterministically with an exact fit`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.rows).toBe(SPEC[d].rows);
      const cells = a.puzzle.pieces.reduce((s, x) => s + x.length, 0);
      expect(cells).toBe(a.puzzle.outline.filter((v) => v === 1).length);
      expect(verify(a.puzzle, a.solution, a.solution).ok).toBe(true);
      expect(countSolutions(a.puzzle, 1)).toBe(1);
    });
  }

  it("every generated layout over 25 seeds is solvable", () => {
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), diffs[i % 4]);
      expect(verify(g.puzzle, g.solution, g.solution)).toEqual({ ok: true, progress: 1 });
      for (const p of g.puzzle.pieces) expect(p.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("verifies any exact cover and rejects near misses and malformed input", () => {
    const g = generate(createRng("verify"), "medium");
    const sol = g.solution;
    const other = complete(g.puzzle)!;
    expect(verify(g.puzzle, sol, other).ok).toBe(true);
    const missing = sol.slice() as SnugState;
    missing[0] = null;
    expect(verify(g.puzzle, sol, missing).reason).toBe("blocks left in the tray");
    const shifted = sol.map((p) => ({ ...p })) as SnugState;
    shifted[0] = { ...sol[0], r: sol[0].r + 1 };
    expect(verify(g.puzzle, sol, shifted).ok).toBe(false);
    expect(verify(g.puzzle, sol, [] as SnugState).reason).toBe("malformed state");
    expect(verify(g.puzzle, sol, sol.map(() => ({ r: 0, c: 0, rot: 7 }))).reason).toBe("malformed state");
    expect(verify(g.puzzle, sol, sol.map(() => "x") as unknown as SnugState).ok).toBe(false);
    // a board with a hole the blocks cannot reach
    const holey: SnugPuzzle = { rows: 2, cols: 3, outline: [1, 1, 1, 1, 1, 1], pieces: [L] };
    expect(verify(holey, [], [{ r: 0, c: 0, rot: 0 }]).reason).toBe("outline not covered");
  });

  it("progress counts legal blocks only", () => {
    const g = generate(createRng("progress"), "easy");
    const s: SnugState = g.solution.map(() => null);
    expect(logic.progress(g.puzzle, g.solution, s)).toBe(0);
    s[0] = g.solution[0];
    const total = g.puzzle.outline.filter((v) => v === 1).length;
    expect(logic.progress(g.puzzle, g.solution, s)).toBeCloseTo(g.puzzle.pieces[0].length / total);
    s[0] = { r: 50, c: 50, rot: 0 };
    expect(logic.progress(g.puzzle, g.solution, s)).toBe(0);
    expect(logic.progress(g.puzzle, g.solution, "x" as unknown as SnugState)).toBe(0);
  });

  it("hints are safe: following them always completes the fit", () => {
    for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
      const g = generate(createRng(`hints:${d}`), d);
      let s: SnugState = g.solution.map(() => null);
      for (let k = 0; k < 40 && !verify(g.puzzle, g.solution, s).ok; k++) {
        const h = hint(g.puzzle, g.solution, s)!;
        expect(h).not.toBeNull();
        const t = h.target as { piece: number; place?: Placement };
        s = s.slice();
        s[t.piece] = t.place ?? null;
      }
      expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, s)).toBeNull();
    }
  });

  it("hints point at illegal or blocking blocks first", () => {
    const g = generate(createRng("hint-bad"), "medium");
    const s: SnugState = g.solution.map(() => null);
    s[1] = { r: 40, c: 40, rot: 0 };
    expect(hint(g.puzzle, g.solution, s)).toEqual({ target: { piece: 1 }, text: "This block does not fit there." });
    // a block parked so the rest cannot fit
    const t: SnugState = [{ r: 0, c: 1, rot: 0 }, null];
    const h = hint(tiny, [{ r: 0, c: 0, rot: 0 }, { r: 0, c: 1, rot: 2 }], t)!;
    expect(h.target).toEqual({ piece: 0 });
    // every placed block blocks: falls back to the first one
    const u: SnugPuzzle = { rows: 1, cols: 4, outline: [1, 1, 1, 1], pieces: [[[0, 0]], [[0, 0]], [[0, 0], [0, 1]]] };
    const blocked: SnugState = [{ r: 0, c: 1, rot: 0 }, { r: 0, c: 2, rot: 0 }, null];
    expect(hint(u, [{ r: 0, c: 0, rot: 0 }, { r: 0, c: 1, rot: 0 }, { r: 0, c: 2, rot: 0 }], blocked)!.target).toEqual({ piece: 0 });
    expect(hint(tiny, [], "x" as unknown as SnugState)).toBeNull();
  });

  it("grades bigger boards as harder", () => {
    const avg = (d: Difficulty) => {
      let s = 0;
      for (let i = 0; i < 4; i++) s += generate(createRng(`g${i}`), d).grade;
      return s / 4;
    };
    expect(avg("medium")).toBeGreaterThan(avg("easy"));
    expect(avg("mega")).toBeGreaterThan(avg("medium"));
    expect(grade(tiny)).toBeGreaterThanOrEqual(0);
  }, 20_000);
  it("hints from the empty board before the first move", () => {
    const g = generate(createRng("pre"), "easy");
    expect(hint(g.puzzle, g.solution, undefined)).toEqual(hint(g.puzzle, g.solution, g.solution.map(() => null)));
    expect(hint(g.puzzle, g.solution, undefined)).not.toBeNull();
  });
});
