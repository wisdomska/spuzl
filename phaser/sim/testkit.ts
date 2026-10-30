/**
 * Shared Vitest suite for Rage Ridge course games: every level has a scripted solution that finishes
 * without a death, the sim is deterministic, the generator is seeded, and verify() accepts real runs
 * and rejects forged deaths, forged time, tampered and malformed logs. Test-only module.
 */
import { expect, it } from "vitest";
import type { Difficulty, GameLogic, InputLog } from "@/games/types";
import { createRng } from "@/lib/rng";
import { replay, type SimCore } from "./core";
import type { CoursePuzzle, CourseSolution, RageState } from "./course";
import { framesToMs } from "./fixed";
import { BTN, framesFromLog, logFromFrames } from "./input";
import { courseLog } from "./scripted";

export interface KitOptions {
  logic: GameLogic<CoursePuzzle, CourseSolution, RageState>;
  ids: string[];
  sim(p: CoursePuzzle): SimCore;
  solutions: Record<string, number[][]>;
  pause: number;
  /** courses must hold between these many levels */
  min?: number;
  max?: number;
  score?: boolean;
}

export const runState = (log: InputLog, deaths: number, frames: number, score?: number): RageState =>
  score === undefined ? { log, deaths, timeMs: framesToMs(frames) } : { log, deaths, timeMs: framesToMs(frames), score };

export function courseGameSuite(o: KitOptions) {
  const { logic } = o;
  const full = (levels: string[]) => courseLog(levels, o.solutions, o.pause);

  it("has a scripted solution for every level that finishes without a death", () => {
    for (const id of o.ids) {
      const r = replay(o.sim({ levels: [id] }), full([id]));
      expect(r.ok, id).toBe(true);
      expect(r.deaths, id).toBe(0);
    }
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a deterministic ${d} course`, () => {
      const a = logic.generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(logic.generate(createRng(`daily:2026-11-02:${d}`), d)).toEqual(a);
      expect(a.puzzle.levels.length).toBeGreaterThanOrEqual(o.min ?? 3);
      expect(a.puzzle.levels.length).toBeLessThanOrEqual(o.max ?? 10);
      expect(a.puzzle.levels.every((id) => o.ids.includes(id))).toBe(true);
      expect(a.grade).toBeGreaterThanOrEqual(0);
      expect(a.grade).toBeLessThanOrEqual(100);
    });
  }

  it("grades longer courses higher", () => {
    const e = logic.generate(createRng("g"), "easy");
    const m = logic.generate(createRng("g"), "mega");
    expect(e.grade).toBeLessThanOrEqual(m.grade);
  });

  it("re-simulates deterministically and verifies scripted courses", () => {
    for (let i = 0; i < 20; i++) {
      const g = logic.generate(createRng(`seed:${i}`), i % 2 ? "hard" : "medium");
      const log = full(g.puzzle.levels);
      const a = replay(o.sim(g.puzzle), log);
      expect(replay(o.sim(g.puzzle), log)).toEqual(a);
      const v = logic.verify(g.puzzle, g.solution, runState(log, a.deaths, log.frames, o.score ? a.score : undefined));
      expect(v.ok, v.reason).toBe(true);
      expect(v.progress).toBe(1);
      expect(logic.progress(g.puzzle, g.solution, runState(log, a.deaths, log.frames))).toBe(1);
    }
  });

  it("rejects forged deaths, time, score and tampered or malformed logs", () => {
    const g = logic.generate(createRng("tamper"), "medium");
    const log = full(g.puzzle.levels);
    const r = replay(o.sim(g.puzzle), log);
    const sc = o.score ? r.score : undefined;
    expect(logic.verify(g.puzzle, g.solution, runState(log, r.deaths + 1, log.frames, sc)).reason).toMatch(/deaths/);
    expect(
      logic.verify(g.puzzle, g.solution, { ...runState(log, r.deaths, log.frames, sc), timeMs: framesToMs(log.frames) - 200 }).reason,
    ).toMatch(/time/);
    if (o.score) expect(logic.verify(g.puzzle, g.solution, runState(log, r.deaths, log.frames, (sc ?? 0) + 5)).reason).toMatch(/score/);
    // take every jump out of the first level: the run changes
    const frames = framesFromLog(log);
    const firstLen = full(g.puzzle.levels.slice(0, 1)).frames;
    for (let i = 0; i < firstLen; i++) frames[i] = frames[i] & ~BTN.JUMP;
    const t = logFromFrames(frames);
    const bad = logic.verify(g.puzzle, g.solution, runState(t, r.deaths, t.frames, sc));
    expect(bad.ok).toBe(false);
    const long = { ...log, frames: log.frames + 10 };
    expect(logic.verify(g.puzzle, g.solution, runState(long, r.deaths, long.frames, sc)).ok).toBe(false);
    expect(logic.verify(g.puzzle, g.solution, null as never).reason).toBe("malformed state");
    expect(logic.verify(g.puzzle, g.solution, { log: { step: 1, events: [], frames: 3 }, deaths: 0, timeMs: 50 }).reason).toBe("bad step");
    const other = { ...g.puzzle, levels: g.puzzle.levels.slice().reverse() };
    if (g.puzzle.levels.length > 1)
      expect(logic.verify(other, g.solution, runState(log, r.deaths, log.frames, sc)).reason).toMatch(/course/);
    expect(logic.progress(g.puzzle, g.solution, null as never)).toBe(0);
  });

  it("partial runs report partial progress", () => {
    const g = logic.generate(createRng("partial"), "hard");
    const first = full(g.puzzle.levels.slice(0, 1));
    const p = logic.progress(g.puzzle, g.solution, runState(first, 0, first.frames));
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });
}
