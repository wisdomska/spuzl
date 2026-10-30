import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, { countSolutions, generate, grade, hint, isPlayerCell, mirrorOf, mismatches, playerCells, solve, SPEC, verify, type ReflectPuzzle, type ReflectState } from "./logic";

const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
// 2×2 vertical mirror: left column given [1, 0]
const tiny: ReflectPuzzle = { size: 2, axis: "v", colors: 1, given: [1, -1, 0, -1] };

describe("reflect", () => {
  it("mirrors across every axis", () => {
    expect(mirrorOf(4, "v", 1)).toBe(2);
    expect(mirrorOf(4, "h", 1)).toBe(13);
    expect(mirrorOf(4, "d", 1)).toBe(4);
    expect(mirrorOf(4, "d", 5)).toBe(5);
    expect(isPlayerCell(5, "v", 3)).toBe(true);
    expect(isPlayerCell(5, "v", 2)).toBe(false);
    expect(isPlayerCell(5, "h", 15)).toBe(true);
    expect(isPlayerCell(4, "d", 1)).toBe(true);
    expect(isPlayerCell(4, "d", 4)).toBe(false);
  });

  it("is unique by construction", () => {
    expect(countSolutions(tiny, 2)).toBe(1);
    expect(solve(tiny)).toEqual([1, 1, 0, 0]);
    expect(countSolutions({ ...tiny, given: [-1, -1, 0, -1] }, 2)).toBe(0);
    expect(playerCells(tiny)).toEqual([1, 3]);
    expect(mismatches(tiny, [1, 0, 0, 1])).toEqual([3]);
  });

  for (const d of diffs) {
    it(`generates ${d} patterns deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.size).toBe(SPEC[d].size);
      expect(a.puzzle.axis).toBe(SPEC[d].axis);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(a.solution).toEqual(solve(a.puzzle));
      const cells = playerCells(a.puzzle);
      expect(cells.every((i) => isPlayerCell(a.puzzle.size, a.puzzle.axis, i))).toBe(true);
      expect(cells.some((i) => a.solution[i] > 0)).toBe(true);
      if (SPEC[d].colors > 1) expect(a.solution).toContain(2);
    });
  }

  it("generates 25 unique patterns", () => {
    for (let i = 0; i < 25; i++) expect(countSolutions(generate(createRng(`free:${i}`), diffs[i % 5]).puzzle, 2)).toBe(1);
  });

  it("verifies the mirror and rejects near misses and malformed input", () => {
    const g = generate(createRng("verify"), "hard");
    expect(verify(g.puzzle, g.solution, g.solution)).toEqual({ ok: true, progress: 1 });
    const i = playerCells(g.puzzle).find((x) => g.solution[x] > 0)!;
    const off = g.solution.slice();
    off[i] = 0;
    expect(verify(g.puzzle, g.solution, off).ok).toBe(false);
    off[i] = g.solution[i] === 1 ? 2 : 1;
    expect(verify(g.puzzle, g.solution, off).reason).toBe("pattern does not mirror");
    expect(verify(g.puzzle, g.solution, [1, 2]).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, g.solution.map(() => 9)).ok).toBe(false);
  });

  it("progress counts correct fills and subtracts wrong ones", () => {
    expect(logic.progress(tiny, [1, 1, 0, 0], [1, 0, 0, 0])).toBe(0);
    expect(logic.progress(tiny, [1, 1, 0, 0], [1, 1, 0, 0])).toBe(1);
    expect(logic.progress(tiny, [1, 1, 0, 0], [1, 1, 0, 1])).toBe(0);
    expect(logic.progress({ ...tiny, given: [0, -1, 0, -1] }, [0, 0, 0, 0], [0, 0, 0, 0])).toBe(1);
    expect(logic.progress(tiny, [1, 1, 0, 0], "x" as unknown as ReflectState)).toBe(0);
  });

  it("hints are safe: following them always completes the mirror", () => {
    for (const d of diffs) {
      const g = generate(createRng(`hints:${d}`), d);
      const s = g.puzzle.given.map((v) => Math.max(0, v));
      const wrongCell = playerCells(g.puzzle).find((x) => g.solution[x] === 0)!;
      s[wrongCell] = 1;
      expect(hint(g.puzzle, g.solution, s)!.target).toBe(wrongCell);
      for (let k = 0; k < 200 && !verify(g.puzzle, g.solution, s).ok; k++) {
        const h = hint(g.puzzle, g.solution, s)!;
        const t = h.target as number;
        s[t] = g.solution[t];
      }
      expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, s)).toBeNull();
    }
    expect(hint(tiny, [1, 1, 0, 0], [] as ReflectState)).toBeNull();
  });

  it("grades harder settings higher", () => {
    const avg = (d: Difficulty) => [0, 1, 2, 3].reduce((s, i) => s + generate(createRng(`g${i}`), d).grade, 0) / 4;
    expect(avg("hard")).toBeGreaterThan(avg("easy"));
    expect(avg("expert")).toBeGreaterThan(avg("hard"));
    expect(grade(tiny)).toBeGreaterThanOrEqual(0);
  });
  it("hints from the empty board before the first move", () => {
    const g = generate(createRng("pre"), "easy");
    expect(hint(g.puzzle, g.solution, undefined)).toEqual(hint(g.puzzle, g.solution, g.puzzle.given.map((v) => Math.max(0, v))));
    expect(hint(g.puzzle, g.solution, undefined)).not.toBeNull();
  });
});
