import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  best, botRun, canMove, DIRS, generate, grade, hint, initialBoard, LIMIT_MS, replay, scoreOf, slide, SPEC, spawner, suggest, TILE_WEIGHT, total, verify,
  type Dir, type MergePuzzle, type MergeState,
} from "./logic";

const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const P: MergePuzzle = { size: 4, seed: "fixed", four: 0.1, limitMs: LIMIT_MS };

/** Plays the bot with timestamps, like a client would. */
function play(p: MergePuzzle, n: number, step = 500): [Dir, number][] {
  const { board: b0, spawn } = initialBoard(p);
  let b = b0;
  const out: [Dir, number][] = [];
  for (let k = 0; k < n; k++) {
    const d = suggest(p.size, b);
    if (!d) break;
    b = spawn(slide(p.size, b, d).board).board;
    out.push([d, k * step]);
  }
  return out;
}

describe("merge", () => {
  it("slides and merges each tile once per move", () => {
    const row = (xs: number[]) => [...xs, ...new Array(12).fill(0)];
    expect(slide(4, row([2, 2, 2, 2]), "L").board.slice(0, 4)).toEqual([4, 4, 0, 0]);
    expect(slide(4, row([2, 2, 4, 0]), "L").board.slice(0, 4)).toEqual([4, 4, 0, 0]);
    expect(slide(4, row([0, 2, 0, 2]), "R").board.slice(0, 4)).toEqual([0, 0, 0, 4]);
    expect(slide(4, row([4, 4, 8, 0]), "R").board.slice(0, 4)).toEqual([0, 0, 8, 8]);
    const col = [2, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0];
    expect(slide(4, col, "U").board.filter((_, i) => i % 4 === 0)).toEqual([4, 8, 0, 0]);
    expect(slide(4, col, "D").board.filter((_, i) => i % 4 === 0)).toEqual([0, 0, 4, 8]);
    const s = slide(4, row([2, 2, 0, 0]), "L");
    expect(s.gained).toBe(4);
    expect(s.mergedAt).toEqual([0]);
    expect(s.trail).toEqual([{ from: 0, to: 0, merged: false }, { from: 1, to: 0, merged: true }]);
    expect(slide(4, row([2, 4, 8, 16]), "L").changed).toBe(false);
  });

  it("spawns deterministically from the seed", () => {
    const a = initialBoard(P).board, b = initialBoard(P).board;
    expect(a).toEqual(b);
    expect(a.filter(Boolean)).toHaveLength(2);
    expect(a.every((v) => v === 0 || v === 2 || v === 4)).toBe(true);
    const full = new Array(16).fill(2);
    expect(spawner(P)(full).at).toBe(-1);
    expect(initialBoard({ ...P, seed: "other" }).board).not.toEqual(a);
  });

  it("knows when the board is stuck", () => {
    const stuck = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    expect(canMove(4, stuck)).toBe(false);
    expect(suggest(4, stuck)).toBeNull();
    expect(canMove(4, [2, 2, ...stuck.slice(2)])).toBe(true);
    expect(best(stuck)).toBe(4);
    expect(total(stuck)).toBe(48);
    expect(scoreOf(stuck)).toBe(4 * TILE_WEIGHT + 48);
  });

  for (const d of diffs) {
    it(`generates ${d} seeds deterministically`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.size).toBe(SPEC[d].size);
      expect(a.puzzle.limitMs).toBe(LIMIT_MS);
      expect(a.solution.botBest).toBeGreaterThanOrEqual(64);
      expect(canMove(a.puzzle.size, initialBoard(a.puzzle).board)).toBe(true);
    });
  }

  it("seeds differ across 25 days and all are playable", () => {
    const seeds = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const g = generate(createRng(`free:${i}`), "easy");
      seeds.add(g.puzzle.seed);
      expect(botRun(g.puzzle, 30).some((v) => v >= 8)).toBe(true);
    }
    expect(seeds.size).toBe(25);
  });

  it("verifies by replaying the log with the same seed", () => {
    const moves = play(P, 120);
    const r = verify(P, { botBest: 0, botSum: 0 }, { moves });
    expect(r.ok).toBe(true);
    const end = replay(P, moves).board;
    expect(r.score).toBe(scoreOf(end));
    expect(r.score! >= best(end) * TILE_WEIGHT).toBe(true);
    // replaying twice gives the same board: same seeded spawns for everyone
    expect(replay(P, moves).board).toEqual(end);
  });

  it("rejects forged or malformed logs", () => {
    const moves = play(P, 30);
    const sol = { botBest: 0, botSum: 0 };
    const noop: [Dir, number][] = [...moves];
    // find a direction that changes nothing at the end, if any; else use a time forgery
    const end = replay(P, moves).board;
    const still = DIRS.find((d) => !slide(4, end, d).changed);
    if (still) {
      noop.push([still, 99_999]);
      expect(verify(P, sol, { moves: noop }).reason).toMatch(/changes nothing/);
    }
    expect(verify(P, sol, { moves: [...moves, [moves[0][0], -5]] }).reason).toMatch(/bad time/);
    expect(verify(P, sol, { moves: [["L", LIMIT_MS + 60_000]] }).ok).toBe(false);
    expect(verify(P, sol, { moves: [["Q" as Dir, 0]] }).reason).toMatch(/malformed/);
    expect(verify(P, sol, { moves: [["L", Number.NaN]] }).ok).toBe(false);
    expect(verify(P, sol, null as unknown as MergeState).reason).toBe("malformed state");
    expect(verify(P, sol, { moves: new Array(20_001).fill(["L", 0]) }).ok).toBe(false);
  });

  it("progress grows with the best tile", () => {
    const sol = { botBest: 0, botSum: 0 };
    const early = logic.progress(P, sol, { moves: [] });
    const later = logic.progress(P, sol, { moves: play(P, 150) });
    expect(later).toBeGreaterThan(early);
    expect(later).toBeLessThanOrEqual(1);
    expect(logic.progress(P, sol, {} as MergeState)).toBe(0);
  });

  it("hints suggest a legal move", () => {
    const sol = { botBest: 0, botSum: 0 };
    const moves = play(P, 40);
    const h = hint(P, sol, { moves })!;
    expect(DIRS).toContain(h.target);
    expect(slide(4, replay(P, moves).board, h.target as Dir).changed).toBe(true);
    expect(h.text).toMatch(/^Try a swipe (up|down|left|right)\.$/);
    expect(hint(P, sol, { moves: [["Q" as Dir, 0]] })).toBeNull();
    expect(hint(P, sol, "x" as unknown as MergeState)).toBeNull();
    // stuck boards have no hint: play until stuck
    const long = play(P, 5000, 1);
    expect(hint(P, sol, { moves: long })).toBeNull();
  }, 20_000);

  it("grades harder settings higher", () => {
    const g = (d: Difficulty) => generate(createRng("grade"), d).grade;
    expect(g("medium")).toBeGreaterThan(g("easy"));
    expect(g("hard")).toBeGreaterThan(g("medium"));
    expect(g("expert")).toBeGreaterThan(g("hard"));
    expect(grade(P, { botBest: 2048, botSum: 0 })).toBeLessThan(grade(P, { botBest: 64, botSum: 0 }));
  });
  it("hints from the empty board before the first move", () => {
    const g = generate(createRng("pre"), "easy");
    expect(hint(g.puzzle, g.solution, undefined)).toEqual(hint(g.puzzle, g.solution, { moves: [] }));
    expect(hint(g.puzzle, g.solution, undefined)).not.toBeNull();
  });
});
