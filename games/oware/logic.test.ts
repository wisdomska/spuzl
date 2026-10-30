import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { BOTTOM_ROW, TOP_ROW, legalPits, own, sideSeeds, sow } from "./engine";
import logic, { countSolutions, gains, generate, grade, hint, verify, type OwarePuzzle } from "./logic";
import owareRules, { CYCLE_LIMIT, type OwareMatch } from "./rules";

const P = (pits: number[]) => pits;

describe("oware engine (Abapa)", () => {
  it("sows anticlockwise and captures 2s and 3s backwards on the rival side", () => {
    //            0  1  2  3  4  5  6  7  8  9 10 11
    const pits = P([0, 0, 0, 3, 0, 0, 1, 2, 0, 0, 0, 0]);
    const r = sow(pits, 3);
    expect(r.path).toEqual([4, 5, 6]);
    expect(r.last).toBe(6);
    expect(r.captured).toEqual([6]);
    expect(r.gain).toBe(2);
    const chain = sow(P([0, 0, 0, 0, 2, 0, 1, 2, 5, 0, 0, 0]), 4);
    expect(chain.last).toBe(6);
    expect(chain.captured).toEqual([6]);
    const back = sow(P([0, 0, 0, 0, 0, 3, 1, 2, 2, 0, 0, 1]), 5);
    expect(back.last).toBe(8);
    expect(back.captured).toEqual([8, 7, 6]);
    expect(back.gain).toBe(3 + 3 + 2);
    expect(back.pits.slice(6, 9)).toEqual([0, 0, 0]);
  });

  it("does not capture on your own side or past the side boundary", () => {
    expect(sow(P([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3]), 0).gain).toBe(0);
    // seat 1 capturing on seat 0's side stops at pit 0
    const r = sow(P([2, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2]), 11);
    expect(r.captured).toEqual([1, 0]);
  });

  it("skips the origin pit on a lap of 12 or more", () => {
    const pits = new Array(12).fill(0);
    pits[0] = 12;
    pits[6] = 1;
    const r = sow(pits, 0);
    expect(r.pits[0]).toBe(0);
    expect(r.path).not.toContain(0);
    expect(r.last).toBe(1);
  });

  it("captures nothing on a grand slam", () => {
    const r = sow(P([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0]), 5);
    expect(r.grandSlam).toBe(true);
    expect(r.gain).toBe(0);
    expect(r.pits[6]).toBe(2);
  });

  it("forces you to feed an empty rival", () => {
    const pits = P([0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0]);
    expect(legalPits(pits, 0)).toEqual([5]);
    expect(legalPits(P([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 0)).toEqual([]);
    expect(own(0, 3)).toBe(true);
    expect(own(1, 3)).toBe(false);
    expect(sideSeeds(pits, 0)).toBe(2);
    expect([...TOP_ROW, ...BOTTOM_ROW].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe("oware puzzles", { timeout: 60_000 }, () => {
  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a deterministic ${d} puzzle with one best pit`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(generate(createRng(`daily:2026-11-02:${d}`), d)).toEqual(a);
      expect(countSolutions(a.puzzle, 3)).toBe(1);
      expect(a.puzzle.pits.reduce((x, y) => x + y, 0) + a.puzzle.scores[0] + a.puzzle.scores[1]).toBe(48);
      if (d === "hard" || d === "expert") expect(gains(a.puzzle).some((g) => g.grandSlam)).toBe(true);
    });
  }

  it("has one best pit over 25 seeds", () => {
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), (["easy", "medium", "hard"] as const)[i % 3]);
      expect(countSolutions(g.puzzle)).toBe(1);
      expect(verify(g.puzzle, g.solution, { pit: g.solution.pit }).ok).toBe(true);
    }
  });

  it("verifies the best pit and rejects others and junk", () => {
    const g = generate(createRng("verify"), "medium");
    expect(verify(g.puzzle, g.solution, { pit: g.solution.pit })).toEqual({ ok: true, progress: 1, score: g.solution.gain });
    const other = legalPits(g.puzzle.pits, 0).find((p) => p !== g.solution.pit)!;
    expect(verify(g.puzzle, g.solution, { pit: other }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { pit: 7 }).reason).toBe("illegal pit");
    expect(verify(g.puzzle, g.solution, { pit: null }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, 5 as never).ok).toBe(false);
    expect(logic.progress(g.puzzle, g.solution, { pit: g.solution.pit })).toBe(1);
    expect(logic.progress(g.puzzle, g.solution, { pit: other })).toBe(0);
    expect(countSolutions({ pits: new Array(12).fill(0).map((_, i) => (i === 0 ? 1 : i === 11 ? 1 : 0)), scores: [23, 23] })).toBe(0);
  });

  it("hints warn off a grand slam, then point at the answer", () => {
    const g = generate(createRng("hint"), "hard");
    const slam = gains(g.puzzle).find((x) => x.grandSlam)!;
    expect(hint(g.puzzle, g.solution, { pit: slam.pit })?.text).toMatch(/grand slam/);
    expect(hint(g.puzzle, g.solution, { pit: null })?.target).toBe(g.solution.pit);
    expect(hint(g.puzzle, g.solution, { pit: g.solution.pit })).toBeNull();
  });

  it("grades harder days higher", () => {
    const avg = (d: Difficulty) => [0, 1, 2, 3].reduce((s, i) => s + generate(createRng(`g${i}`), d).grade, 0) / 4;
    expect(avg("easy")).toBeLessThan(avg("medium"));
    expect(avg("medium")).toBeLessThan(avg("hard"));
    expect(avg("hard")).toBeLessThan(avg("mega"));
    const p: OwarePuzzle = { pits: P([0, 0, 0, 3, 0, 0, 1, 2, 0, 0, 0, 1]), scores: [20, 21] };
    expect(grade(p)).toBeGreaterThan(0);
  });
});

describe("oware match rules", () => {
  const rng = createRng("m");

  it("starts with 4 seeds per pit and validates turns", () => {
    const s = owareRules.initial(2, rng);
    expect(s.pits).toEqual(new Array(12).fill(4));
    expect(owareRules.legalMoves(s, 0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(owareRules.legalMoves(s, 1)).toEqual([]);
    expect(owareRules.isLegal(s, 0, 6)).toBe(false);
    expect(() => owareRules.apply(s, 1, 6, rng)).toThrow();
    expect(() => owareRules.apply(s, 0, 6, rng)).toThrow();
    const s2 = owareRules.apply(s, 0, 2, rng);
    expect(owareRules.turn(s2)).toBe(1);
    expect(s2.pits.slice(3, 7)).toEqual([5, 5, 5, 5]);
  });

  it("scores captures and ends at 25", () => {
    const s: OwareMatch = { pits: P([0, 0, 0, 3, 0, 0, 1, 2, 0, 0, 0, 4]), scores: [23, 15], turn: 0, quiet: 3, over: false, history: [] };
    const t = owareRules.apply(s, 0, 3, rng);
    expect(t.scores[0]).toBe(25);
    expect(owareRules.status(t)).toMatchObject({ over: true, winner: 0, reason: "score" });
    expect(() => owareRules.apply(t, 1, 11, rng)).toThrow("game over");
    expect(owareRules.status({ ...s, scores: [24, 24], pits: new Array(12).fill(0) }).winner).toBeNull();
  });

  it("ends when the mover cannot feed, and on an endless cycle", () => {
    const stuck: OwareMatch = { pits: P([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), scores: [20, 22], turn: 0, quiet: 0, over: false, history: [] };
    expect(owareRules.status(stuck)).toMatchObject({ over: true, winner: 1, reason: "no moves" });
    expect(owareRules.legalMoves(stuck, 0)).toEqual([]);
    const cyc: OwareMatch = { pits: P([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]), scores: [23, 23], turn: 0, quiet: CYCLE_LIMIT, over: false, history: [] };
    expect(owareRules.status(cyc)).toMatchObject({ over: true, winner: null, reason: "cycle" });
  });

  it("practice bot plays legal moves and takes the biggest capture", () => {
    const r = createRng("bot");
    let s = owareRules.initial(2, r);
    for (let i = 0; i < 300 && !owareRules.status(s).over; i++) {
      const seat = owareRules.turn(s);
      const m = owareRules.botMove!(s, seat, r);
      expect(owareRules.isLegal(s, seat, m)).toBe(true);
      s = owareRules.apply(s, seat, m, r);
    }
    expect(owareRules.status(s).over).toBe(true);
    const s2: OwareMatch = { pits: P([0, 0, 0, 3, 0, 1, 1, 2, 0, 0, 0, 4]), scores: [10, 10], turn: 0, quiet: 0, over: false, history: [] };
    expect(owareRules.botMove!(s2, 0, r)).toBe(3);
    expect(() => owareRules.botMove!({ ...s2, pits: new Array(12).fill(0) }, 0, r)).toThrow();
  });
});
