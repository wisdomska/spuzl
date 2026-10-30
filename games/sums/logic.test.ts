import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  analyze,
  combos,
  countSolutions,
  deduce,
  generate,
  grade,
  hint,
  runsOf,
  solve,
  SPEC,
  verify,
  type SumsPuzzle,
  type SumsState,
} from "./logic";

const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
// 3×3 with a 2×2 white block:   .  4  3
//                               3  1  2
//                               4  3  1     → across 3 = 1+2, across 4 = 3+1; down 4 = 1+3, down 3 = 2+1
const tiny: SumsPuzzle = {
  rows: 3,
  cols: 3,
  white: [0, 0, 0, 0, 1, 1, 0, 1, 1],
  down: [0, 4, 3, 0, 0, 0, 0, 0, 0],
  right: [0, 0, 0, 3, 0, 0, 4, 0, 0],
};
const tinySol = [0, 0, 0, 0, 1, 2, 0, 3, 1];

describe("sums", () => {
  it("lists digit combinations and runs", () => {
    expect(combos(2, 3)).toEqual([0b110]);
    expect(combos(2, 17)).toEqual([0b1100000000]);
    expect(combos(3, 6)).toHaveLength(1);
    expect(combos(10, 3)).toEqual([]);
    expect(runsOf(tiny).map((r) => [r.dir, r.sum, r.cells])).toEqual([
      ["down", 4, [4, 7]],
      ["down", 3, [5, 8]],
      ["across", 3, [4, 5]],
      ["across", 4, [7, 8]],
    ]);
  });

  it("analyses repeats, overshoot and wrong totals", () => {
    expect(analyze(tiny, [0, 0, 0, 0, 1, 1, 0, 0, 0]).rule).toBe("repeat");
    expect(analyze(tiny, [0, 0, 0, 0, 3, 0, 0, 0, 0]).rule).toBe("over");
    expect(analyze(tiny, [0, 0, 0, 0, 1, 0, 0, 2, 0]).rule).toBe("short");
    expect(analyze(tiny, tinySol).clear).toBe(true);
    expect(analyze(tiny, tinySol).message).toBe("");
  });

  it("solves the hand puzzle uniquely", () => {
    expect(countSolutions(tiny, 5)).toBe(1);
    expect(solve(tiny)).toEqual(tinySol);
    expect(deduce(tiny)!.filter((m) => m)).toHaveLength(4);
    expect(deduce(tiny, [0, 0, 0, 0, 2, 2, 0, 0, 0])).toBeNull();
    expect(solve(tiny, [0, 0, 0, 0, 2, 0, 0, 0, 0])).toBeNull();
    // an ambiguous square: 4 = 1+3 both ways
    const amb: SumsPuzzle = { ...tiny, down: [0, 4, 4, 0, 0, 0, 0, 0, 0], right: [0, 0, 0, 4, 0, 0, 4, 0, 0] };
    expect(countSolutions(amb, 5)).toBe(2);
  });

  for (const d of diffs) {
    it(`generates unique ${d} grids deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.rows).toBe(SPEC[d].size);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(solve(a.puzzle)).toEqual(a.solution);
      for (const r of runsOf(a.puzzle)) {
        expect(r.cells.length).toBeGreaterThanOrEqual(2);
        expect(r.cells.length).toBeLessThanOrEqual(SPEC[d].maxRun);
      }
    }, 60_000);
  }

  it("generates 20 unique grids across seeds", () => {
    for (let i = 0; i < 20; i++) expect(countSolutions(generate(createRng(`free:${i}`), i % 2 ? "medium" : "easy").puzzle, 2)).toBe(1);
  }, 60_000);

  it("verifies the solution and rejects near misses and malformed input", () => {
    const g = generate(createRng("verify"), "medium");
    expect(verify(g.puzzle, g.solution, g.solution)).toEqual({ ok: true, progress: 1 });
    const i = g.puzzle.white.indexOf(1);
    const off = g.solution.slice();
    off[i] = 0;
    expect(verify(g.puzzle, g.solution, off).reason).toBe("incomplete");
    off[i] = g.solution[i] === 9 ? 8 : g.solution[i] + 1;
    expect(verify(g.puzzle, g.solution, off).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, [1, 2]).reason).toBe("malformed state");
    const block = g.solution.slice();
    block[0] = 5;
    expect(verify(g.puzzle, g.solution, block).ok).toBe(false);
    expect(
      verify(
        g.puzzle,
        g.solution,
        g.solution.map((v) => v * 10),
      ).ok,
    ).toBe(false);
    // a valid grid that is not the stored answer (tampered secret)
    expect(verify(tiny, [0, 0, 0, 0, 2, 1, 0, 2, 2], tinySol).reason).toBe("valid but not the scheduled solution");
  });

  it("progress counts right digits minus wrong ones", () => {
    expect(logic.progress(tiny, tinySol, [0, 0, 0, 0, 1, 0, 0, 0, 0])).toBe(0.25);
    expect(logic.progress(tiny, tinySol, [0, 0, 0, 0, 1, 1, 0, 0, 0])).toBe(0);
    expect(logic.progress(tiny, tinySol, "x" as unknown as SumsState)).toBe(0);
  });

  it("hints are safe: following them always completes the grid", () => {
    for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
      const g = generate(createRng(`hints:${d}`), d);
      const s = new Array(g.puzzle.rows * g.puzzle.cols).fill(0);
      const first = g.puzzle.white.indexOf(1);
      s[first] = g.solution[first] === 1 ? 2 : 1;
      expect(hint(g.puzzle, g.solution, s)!.target).toBe(first);
      s[first] = 0;
      for (let k = 0; k < 200 && !verify(g.puzzle, g.solution, s).ok; k++) {
        const h = hint(g.puzzle, g.solution, s)!;
        const i = h.target as number;
        const m = h.text.match(/(\d)/);
        expect(Number(m![1])).toBe(g.solution[i]);
        s[i] = g.solution[i];
      }
      expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, s)).toBeNull();
    }
    expect(hint(tiny, tinySol, [] as SumsState)).toBeNull();
  }, 30_000);

  it("hint reveals a digit when propagation is stuck", () => {
    // ambiguous-looking start: wipe clues so propagation alone cannot settle a cell
    const amb: SumsPuzzle = { ...tiny, down: [0, 4, 4, 0, 0, 0, 0, 0, 0], right: [0, 0, 0, 4, 0, 0, 4, 0, 0] };
    const h = hint(amb, [0, 0, 0, 0, 1, 3, 0, 3, 1], new Array(9).fill(0))!;
    expect(h.text).toBe("Try 1 here.");
  });

  it("grades bigger grids as harder", () => {
    const avg = (d: Difficulty) => [0, 1, 2].reduce((s, i) => s + generate(createRng(`g${i}`), d).grade, 0) / 3;
    expect(avg("hard")).toBeGreaterThan(avg("easy"));
    expect(avg("expert")).toBeGreaterThan(avg("medium"));
    expect(grade(tiny)).toBeGreaterThanOrEqual(0);
  }, 60_000);
  it("hints from the empty board before the first move", () => {
    const g = generate(createRng("pre"), "easy");
    expect(hint(g.puzzle, g.solution, undefined)).toEqual(hint(g.puzzle, g.solution, new Array(g.puzzle.rows * g.puzzle.cols).fill(0)));
    expect(hint(g.puzzle, g.solution, undefined)).not.toBeNull();
  });
});
