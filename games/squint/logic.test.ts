import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  bbox,
  differences,
  generate,
  grade,
  H,
  hint,
  hitTest,
  MIN_HIT,
  regionOf,
  SPEC,
  verify,
  W,
  type Box,
  type Obj,
  type SquintPuzzle,
  type SquintState,
} from "./logic";

const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const obj = (id: string, extra: Partial<Obj> = {}): Obj => ({ id, kind: "flower", x: 10, y: 130, s: 1, color: "#FF6B6B", v: 0, ...extra });
const scene = (objs: Obj[]) => ({ sky: "#fff", ground: "#0f0", hills: [], objs });
const tiny: SquintPuzzle = {
  w: W,
  h: H,
  a: scene([obj("a"), obj("b", { x: 100 }), obj("c", { x: 200, kind: "bird", y: 20 })]),
  b: scene([obj("a", { color: "#4D8BFF" }), obj("b", { x: 100 }), obj("d", { x: 250, y: 150 })]),
};

describe("squint", () => {
  it("finds differences by object, including removals and additions", () => {
    expect(differences(tiny)).toEqual(["a", "c", "d"]);
    expect(bbox(obj("x", { s: 2 }))).toEqual({ x: 10, y: 130, w: 28, h: 48 });
    const r = regionOf(tiny, "a");
    expect(r.w).toBeGreaterThanOrEqual(MIN_HIT);
    expect(r.h).toBeGreaterThanOrEqual(MIN_HIT);
    expect(hitTest(tiny, 17, 140)).toBe("a");
    expect(hitTest(tiny, 17, 140, ["a"])).toBeNull();
    expect(hitTest(tiny, 107, 140)).toBeNull();
    expect(hitTest(tiny, 212, 25)).toBe("c");
  });

  for (const d of diffs) {
    it(`generates ${d} scenes deterministically with separate regions`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.solution).toHaveLength(SPEC[d].diffs);
      expect(a.solution).toEqual(differences(a.puzzle));
      const rs = a.solution.map((id) => regionOf(a.puzzle, id));
      const ov = (p: Box, q: Box) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
      rs.forEach((p, i) => rs.forEach((q, j) => j > i && expect(ov(p, q)).toBe(false)));
      // every region centre hits its own difference
      a.solution.forEach((id, i) => expect(hitTest(a.puzzle, rs[i].x + rs[i].w / 2, rs[i].y + rs[i].h / 2)).toBe(id));
    });
  }

  it("generates 25 scenes with the right number of differences", () => {
    for (let i = 0; i < 25; i++) {
      const d = diffs[i % 5];
      const g = generate(createRng(`free:${i}`), d);
      expect(g.solution).toHaveLength(SPEC[d].diffs);
      expect(g.puzzle.a.objs.every((o) => o.x >= 0 && o.y >= 0 && bbox(o).x + bbox(o).w <= W + 1)).toBe(true);
    }
  });

  it("verifies set equality and rejects near misses and malformed input", () => {
    const g = generate(createRng("verify"), "medium");
    const all: SquintState = { found: [...g.solution].reverse(), misses: 3 };
    expect(verify(g.puzzle, g.solution, all)).toEqual({ ok: true, progress: 1 });
    expect(verify(g.puzzle, g.solution, { found: g.solution.slice(1), misses: 0 }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { found: [...g.solution, "zz"], misses: 0 }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { found: [...g.solution, g.solution[0]], misses: 0 }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { found: [1, 2] as unknown as string[], misses: 0 }).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, { found: [], misses: -1 }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as unknown as SquintState).ok).toBe(false);
    expect(verify(g.puzzle, ["o1"], { found: ["o1"], misses: 0 }).reason).toBe("answer does not match the scenes");
  });

  it("progress counts found differences and punishes guessed ids", () => {
    const g = generate(createRng("progress"), "easy");
    expect(logic.progress(g.puzzle, g.solution, { found: [g.solution[0]], misses: 0 })).toBeCloseTo(1 / 3);
    expect(logic.progress(g.puzzle, g.solution, { found: [g.solution[0], "nope"], misses: 0 })).toBe(0);
    expect(logic.progress(g.puzzle, g.solution, {} as SquintState)).toBe(0);
  });

  it("hints point at an unfound difference until all are found", () => {
    for (const d of diffs) {
      const g = generate(createRng(`hints:${d}`), d);
      const s: SquintState = { found: [], misses: 0 };
      for (let k = 0; k < 10; k++) {
        const h = hint(g.puzzle, g.solution, s);
        if (!h) break;
        expect(h.text).toMatch(/^Look closely at the (top|middle|bottom) (left|centre|right)\.$/);
        const r = h.target as Box;
        const id = hitTest(g.puzzle, r.x + r.w / 2, r.y + r.h / 2, s.found)!;
        expect(g.solution).toContain(id);
        s.found.push(id);
      }
      expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
    }
    expect(hint(tiny, [], "x" as unknown as SquintState)).toBeNull();
  });

  it("grades harder settings higher", () => {
    const avg = (d: Difficulty) => [0, 1, 2, 3].reduce((s, i) => s + generate(createRng(`g${i}`), d).grade, 0) / 4;
    expect(avg("medium")).toBeGreaterThan(avg("easy"));
    expect(avg("expert")).toBeGreaterThan(avg("medium"));
    expect(grade(tiny)).toBeGreaterThanOrEqual(0);
  });
  it("hints from the empty board before the first move", () => {
    const g = generate(createRng("pre"), "easy");
    expect(hint(g.puzzle, g.solution, undefined)).toEqual(hint(g.puzzle, g.solution, { found: [], misses: 0 }));
    expect(hint(g.puzzle, g.solution, undefined)).not.toBeNull();
  });
});
