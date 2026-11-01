import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  applyMove,
  cellsOf,
  decodeLot,
  deepLots,
  distances,
  encodeLot,
  EXIT_COL,
  explain,
  generate,
  hint,
  isSolved,
  legalMoves,
  occupancy,
  replay,
  room,
  solve,
  SPEC,
  verify,
  type Move,
  type TrotroPuzzle,
} from "./logic";

/** A hand-made lot: trotro at columns 0-1 of row 2, a car standing in its way at column 3 (rows 1-2). */
const tiny: TrotroPuzzle = {
  size: 6,
  exitRow: 2,
  vehicles: [
    { len: 2, axis: "h", line: 2 },
    { len: 2, axis: "v", line: 3 },
    { len: 3, axis: "h", line: 0 },
  ],
  start: [0, 1, 1],
  par: 2,
};

describe("trotro mechanics", () => {
  it("knows how far each vehicle can slide", () => {
    expect(room(tiny, tiny.start, 0)).toEqual([0, 1]);
    expect(room(tiny, tiny.start, 1)).toEqual([0, 3]); // the truck on row 0 covers column 3, so no room up
    expect(room(tiny, tiny.start, 2)).toEqual([-1, 2]);
    expect(occupancy(tiny, tiny.start).filter((v) => v >= 0)).toHaveLength(7);
  });

  it("applies only legal slides", () => {
    expect(applyMove(tiny, tiny.start, [1, 2])).toEqual([0, 3, 1]);
    expect(applyMove(tiny, tiny.start, [1, -1])).toBeNull(); // blocked by the truck
    expect(applyMove(tiny, tiny.start, [0, 3])).toBeNull(); // through the car
    expect(applyMove(tiny, tiny.start, [0, 0])).toBeNull();
    expect(applyMove(tiny, tiny.start, [5, 1])).toBeNull();
    expect(applyMove(tiny, tiny.start, [0, 1.5] as Move)).toBeNull();
  });

  it("solves the tiny lot in two moves with a reason", () => {
    const route = solve(tiny, tiny.start)!;
    expect(route).toHaveLength(2);
    expect(isSolved(replay(tiny, route)!)).toBe(true);
    const d = distances(tiny, tiny.start)!;
    expect(d.dist[0]).toBe(2);
    const h = hint(tiny, { moves: route }, { moves: [] })!;
    expect(h.target).toEqual({ vehicle: 1, delta: 2 });
    expect(h.text).toBe("Move the purple car A down to open the road for the trotro.");
    expect(explain(tiny, [0, 3, 1], [[0, 4]])).toBe("The road is clear, so drive the trotro to the exit.");
  });
});

describe("trotro generation", () => {
  for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
    it(`generates 20 solvable ${d} lots with a true minimum in range`, () => {
      const [lo, hi] = SPEC[d].range;
      for (let i = 0; i < 20; i++) {
        const g = generate(createRng(`trotro:${d}:${i}`), d);
        const p = g.puzzle;
        expect(p.start[0]).not.toBe(EXIT_COL);
        expect(p.vehicles[0]).toEqual({ len: 2, axis: "h", line: p.exitRow });
        // Nothing else lies across the exit row.
        expect(p.vehicles.slice(1).every((v) => !(v.axis === "h" && v.line === p.exitRow))).toBe(true);
        expect(g.solution.moves).toHaveLength(p.par);
        expect(p.par).toBeGreaterThanOrEqual(lo);
        expect(p.par).toBeLessThanOrEqual(hi);
        expect(verify(p, g.solution, { moves: g.solution.moves })).toEqual({ ok: true, progress: 1 });
        // The par is the true minimum: an independent BFS agrees.
        expect(solve(p, p.start)!.length).toBe(p.par);
        expect(g.grade).toBeGreaterThanOrEqual(0);
        expect(g.grade).toBeLessThanOrEqual(100);
      }
    }, 120_000);
  }

  for (const d of ["expert", "mega"] as Difficulty[])
    it(`generates 20 ${d} lots in range, with the level's vehicle count, each its own`, () => {
      const [lo, hi] = SPEC[d].range;
      const seen = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const g = generate(createRng(`trotro:${d}:${i}`), d);
        const p = g.puzzle;
        expect(p.par).toBeGreaterThanOrEqual(lo);
        expect(p.par).toBeLessThanOrEqual(hi);
        expect(p.vehicles.length - 1).toBeGreaterThanOrEqual(SPEC[d].others[0]);
        expect(p.vehicles.length - 1).toBeLessThanOrEqual(SPEC[d].others[1]);
        expect(verify(p, g.solution, { moves: g.solution.moves })).toEqual({ ok: true, progress: 1 });
        expect(solve(p, p.start)!.length).toBe(p.par);
        seen.add(encodeLot(p.vehicles, p.start));
      }
      expect(seen.size).toBe(20);
    }, 120_000);

  it("is deterministic per seed and difficulty", () => {
    for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
      const a = generate(createRng("daily:trotro"), d);
      expect(generate(createRng("daily:trotro"), d)).toEqual(a);
    }
  }, 60_000);

  it("every bank lot is legal and deep", () => {
    for (const lot of deepLots()) {
      expect(lot.vehicles[0]).toEqual({ len: 2, axis: "h", line: 2 });
      expect(lot.vehicles.slice(1).every((v) => !(v.axis === "h" && v.line === 2))).toBe(true);
      // No two vehicles share a cell, and each stays on the board.
      const cells = lot.vehicles.flatMap((v, i) => cellsOf(6, v, lot.pos[i]));
      expect(new Set(cells).size).toBe(cells.length);
      expect(cells.every((c) => c >= 0 && c < 36)).toBe(true);
      expect(decodeLot(encodeLot(lot.vehicles, lot.pos))).toEqual(lot);
      const sp = distances({ size: 6, vehicles: lot.vehicles }, lot.pos, 6000)!;
      expect(Math.max(...sp.dist.filter((x) => x !== Infinity))).toBeGreaterThanOrEqual(22);
    }
  }, 60_000);

  it("generates each board in under half a second", () => {
    // Warm the JIT, then time 10 boards per level. The search count is bounded (a walk of at most 64
    // position-space searches from a deep lot); typical boards take under 150 ms. Coverage instrumentation
    // (CI runs `test:coverage`) slows the hot loop about threefold, so the budget follows it there.
    const worker = (globalThis as { __vitest_worker__?: { config?: { coverage?: { enabled?: boolean } } } }).__vitest_worker__;
    const budget = worker?.config?.coverage?.enabled ? 1500 : 500;
    generate(createRng("warm"), "hard");
    for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[])
      for (let i = 0; i < 10; i++) {
        const t0 = performance.now();
        generate(createRng(`timing:${d}:${i}`), d);
        expect(performance.now() - t0, `${d} seed ${i}`).toBeLessThan(budget);
      }
  }, 60_000);
});

describe("trotro verification", () => {
  const g = generate(createRng("verify"), "medium");

  it("replays the log and rejects illegal or unfinished ones", () => {
    const ms = g.solution.moves;
    expect(verify(g.puzzle, g.solution, { moves: ms.slice(0, -1) }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { moves: ms.slice(0, -1) }).reason).toBe("trotro still parked");
    // Teleporting the trotro is an illegal slide.
    expect(verify(g.puzzle, g.solution, { moves: [[0, EXIT_COL - g.puzzle.start[0]]] }).reason).toBe("illegal slide");
    expect(verify(g.puzzle, g.solution, { moves: [[0, 0]] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as never).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, { moves: [["a", 1]] } as never).reason).toBe("malformed state");
    expect(verify(g.puzzle, g.solution, { moves: new Array(1200).fill([1, 1]) }).reason).toBe("malformed state");
  });

  it("accepts any legal route, not only the stored one", () => {
    // A detour: shuffle some vehicle back and forth first, then follow the solution.
    const start = g.puzzle.start;
    const wiggle = legalMoves(g.puzzle, start).find((m) => m[0] !== 0)!;
    const moves: Move[] = [wiggle, [wiggle[0], -wiggle[1]], ...g.solution.moves];
    expect(verify(g.puzzle, g.solution, { moves }).ok).toBe(true);
  });

  it("progress follows the moves still needed and never leaks a route", () => {
    expect(logic.progress(g.puzzle, g.solution, { moves: [] })).toBe(0);
    const half = g.solution.moves.slice(0, Math.floor(g.puzzle.par / 2));
    const p = logic.progress(g.puzzle, g.solution, { moves: half });
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
    expect(logic.progress(g.puzzle, g.solution, { moves: g.solution.moves })).toBe(1);
    expect(logic.progress(g.puzzle, g.solution, { moves: [[0, 9]] })).toBe(0);
  });
});

describe("trotro hints", () => {
  it("follow an optimal path to the exit with a reason every step", () => {
    for (const d of ["easy", "hard"] as Difficulty[]) {
      const g = generate(createRng(`hints:${d}`), d);
      const s = { moves: [] as Move[] };
      for (let k = 0; k < g.puzzle.par; k++) {
        const h = hint(g.puzzle, g.solution, s)!;
        expect(h.text).toMatch(/^(Move the|The road is clear)/);
        expect(h.text).not.toMatch(/[–—]/);
        const t = h.target as { vehicle: number; delta: number };
        expect(applyMove(g.puzzle, replay(g.puzzle, s.moves)!, [t.vehicle, t.delta])).not.toBeNull();
        s.moves.push([t.vehicle, t.delta]);
      }
      expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, s)).toBeNull();
    }
  }, 60_000);

  it("explain names the vehicle that the move makes room for", () => {
    const g = generate(createRng("hints:why"), "medium");
    const texts = new Set<string>();
    let pos = g.puzzle.start;
    for (let k = 0; k < g.solution.moves.length; k++) {
      texts.add(explain(g.puzzle, pos, g.solution.moves.slice(k)));
      pos = applyMove(g.puzzle, pos, g.solution.moves[k])!;
    }
    expect([...texts].some((t) => / so the .* can slide (up|down|left|right)\.$/.test(t) || /open the road/.test(t))).toBe(true);
  });

  it("returns null for a malformed or illegal log", () => {
    const g = generate(createRng("hints:bad"), "easy");
    expect(hint(g.puzzle, g.solution, { moves: [[0, 9]] })).toBeNull();
    expect(hint(g.puzzle, g.solution, null as never)).toBeNull();
  });
});
