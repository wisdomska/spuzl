import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  apply,
  bestReachable,
  closest,
  generate,
  grade,
  hint,
  MAX_SCORE,
  reachable,
  replay,
  route,
  scoreFor,
  verify,
  type DeadOnPuzzle,
  type DeadOnState,
  type Step,
} from "./logic";

const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const p: DeadOnPuzzle = { numbers: [75, 50, 8, 6, 3, 2], target: 347 };
const sol = { best: 347, steps: [] as Step[] };

describe("deadon", () => {
  it("applies operators with whole numbers only", () => {
    expect(apply(7, "+", 2)).toEqual({ value: 9 });
    expect(apply(7, "-", 9)).toEqual({ value: -2 });
    expect(apply(7, "*", 2)).toEqual({ value: 14 });
    expect(apply(8, "/", 2)).toEqual({ value: 4 });
    expect(apply(7, "/", 2)).toEqual({ error: "fraction" });
    expect(apply(7, "/", 0)).toEqual({ error: "zero" });
    expect(apply(7, "%" as never, 0)).toEqual({ error: "op" });
  });

  it("replays the design example and finds the closest tile", () => {
    const r = replay(p, [
      [1, "-", 3],
      [6, "*", 2],
    ]);
    expect(r.error).toBeNull();
    expect(r.values.slice(6)).toEqual([44, 352]);
    expect(r.live).toEqual([0, 4, 5, 7]);
    expect(closest(p, r)).toBe(352);
    expect(
      replay(p, [
        [1, "-", 3],
        [1, "+", 2],
      ]).error,
    ).toBe("used");
    expect(replay(p, [[1, "-", 1]]).error).toBe("same");
    expect(replay(p, [[9, "-", 1]]).error).toBe("used");
    expect(replay(p, [[0, "?" as never, 1]]).error).toBe("op");
    expect(replay(p, [[0, "/", 2]]).error).toBe("fraction");
    expect(replay(p, ["bad" as unknown as Step]).error).toBe("op");
    expect(closest({ numbers: [10, 14], target: 12 }, replay({ numbers: [10, 14], target: 12 }, []))).toBe(10);
  });

  it("solver reaches the design target and reports min operations", () => {
    const reach = reachable(p.numbers);
    expect(reach.get(75)).toBe(0);
    expect(reach.get(125)).toBe(1);
    expect(reach.has(347)).toBe(true);
    expect(bestReachable([1, 2], 10)).toBe(3);
    expect(bestReachable([100, 2], 1000)).toBe(200);
    const r = replay(p, []);
    const path = route(r.values, r.live, 347)!;
    const done = replay(p, path);
    expect(done.error).toBeNull();
    expect(done.values[done.values.length - 1]).toBe(347);
    expect(route([1, 2], [0, 1], 100)).toBeNull();
    expect(route([5, 7], [0, 1], 7)).toEqual([]);
  });

  for (const d of diffs) {
    it(`generates ${d} puzzles deterministically with a reachable target`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.numbers).toHaveLength(6);
      expect(a.solution.best).toBe(a.puzzle.target);
      const r = replay(a.puzzle, a.solution.steps);
      expect(r.error).toBeNull();
      expect(r.values[r.values.length - 1]).toBe(a.puzzle.target);
      expect(a.puzzle.numbers).not.toContain(a.puzzle.target);
    });
  }

  it("every generated target is reachable over 25 seeds", () => {
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), diffs[i % 5]);
      expect(bestReachable(g.puzzle.numbers, g.puzzle.target)).toBe(g.puzzle.target);
      expect(verify(g.puzzle, g.solution, { steps: g.solution.steps }).score).toBe(MAX_SCORE);
    }
  }, 30_000);

  it("scores by distance and rejects illegal or malformed logs", () => {
    const g = generate(createRng("verify"), "medium");
    expect(verify(g.puzzle, g.solution, { steps: g.solution.steps })).toEqual({ ok: true, progress: 1, score: MAX_SCORE });
    const none = verify(g.puzzle, g.solution, { steps: [] });
    expect(none.ok).toBe(true);
    const nearest = closest(g.puzzle, replay(g.puzzle, []));
    expect(none.score).toBe(MAX_SCORE - Math.abs(nearest - g.puzzle.target));
    expect(none.progress).toBeLessThan(1);
    expect(verify(g.puzzle, g.solution, { steps: [[0, "+", 0]] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as unknown as DeadOnState).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, { steps: new Array(6).fill([0, "+", 1]) }).ok).toBe(false);
    expect(scoreFor(p, sol, 352)).toBe(995);
    expect(scoreFor(p, sol, 10_000)).toBe(0);
    // graded against the best reachable value when the target is out of reach
    expect(scoreFor({ numbers: [1, 2], target: 10 }, { best: 3, steps: [] }, 3)).toBe(MAX_SCORE);
  });

  it("progress never leaks and handles bad input", () => {
    const g = generate(createRng("progress"), "easy");
    expect(logic.progress(g.puzzle, g.solution, { steps: [] })).toBeGreaterThanOrEqual(0);
    expect(logic.progress(g.puzzle, g.solution, { steps: [[0, "/", 0]] })).toBe(0);
    expect(logic.progress(g.puzzle, g.solution, {} as DeadOnState)).toBe(0);
  });

  it("hints are safe: following them always hits the target", () => {
    for (const d of diffs) {
      const g = generate(createRng(`hints:${d}`), d);
      let steps: Step[] = [];
      for (let k = 0; k < 6; k++) {
        const h = hint(g.puzzle, g.solution, { steps });
        if (!h) break;
        const t = h.target as { tiles: number[]; op: Step[1] };
        steps = [...steps, [t.tiles[0], t.op, t.tiles[1]]];
        expect(replay(g.puzzle, steps).error).toBeNull();
      }
      const r = replay(g.puzzle, steps);
      expect(closest(g.puzzle, r)).toBe(g.puzzle.target);
      expect(hint(g.puzzle, g.solution, { steps })).toBeNull();
    }
  });

  it("hint asks for an undo when the target is out of reach", () => {
    const q: DeadOnPuzzle = { numbers: [2, 3, 5, 7, 11, 13], target: 26 };
    // 13 + 11 = 24, then 24 * 7 = 168 ... keep combining far away until only big tiles remain
    const steps: Step[] = [
      [4, "*", 5],
      [0, "*", 1],
      [6, "*", 7],
      [8, "*", 2],
      [9, "*", 3],
    ];
    const h = hint(q, { best: 26, steps: [] }, { steps });
    expect(h?.target).toEqual({ undo: true });
    expect(hint(q, { best: 26, steps: [] }, { steps: [[0, "/", 1]] })).toBeNull();
    expect(hint(q, { best: 26, steps: [] }, null as unknown as DeadOnState)).toBeNull();
  });

  it("grades harder settings higher on average", () => {
    const avg = (d: Difficulty) => {
      let s = 0;
      for (let i = 0; i < 5; i++) s += generate(createRng(`g${i}`), d).grade;
      return s / 5;
    };
    const e = avg("easy"),
      m = avg("medium"),
      x = avg("expert");
    expect(m).toBeGreaterThan(e);
    expect(x).toBeGreaterThan(m);
    expect(grade(p)).toBeGreaterThanOrEqual(0);
    expect(grade({ numbers: [1, 1], target: 999 })).toBeLessThanOrEqual(100);
  }, 30_000);
  it("hints from the empty board before the first move", () => {
    const g = generate(createRng("pre"), "easy");
    expect(hint(g.puzzle, g.solution, undefined)).toEqual(hint(g.puzzle, g.solution, { steps: [] }));
    expect(hint(g.puzzle, g.solution, undefined)).not.toBeNull();
  });
});
