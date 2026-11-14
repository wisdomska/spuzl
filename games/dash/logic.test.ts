import { describe, expect, it } from "vitest";
import type { Difficulty, InputLog } from "@/games/types";
import { createRng } from "@/lib/rng";
import { replay } from "@/phaser/sim/core";
import { framesToMs } from "@/phaser/sim/fixed";
import { BTN, logFromFrames } from "@/phaser/sim/input";
import { PRESETS } from "@/phaser/sim/runner";
import { solveRun } from "@/phaser/sim/runner-bot";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import logic, { createSim, freshState, runName } from "./logic";
import { DIFFICULTIES, LEVELS } from "./levels";

/** The bot runs `metres`, then stops acting until it crashes: a finished endless run and its honest state. */
function endlessRun(p: CoursePuzzle, metres: number): { log: InputLog; state: RageState } {
  const frames = solveRun(createSim(p), metres, 4)!;
  const s = createSim(p);
  for (const b of frames) s.step(b);
  while (!s.finished) {
    s.step(0);
    frames.push(0);
  }
  const log = logFromFrames(frames);
  return { log, state: { log, deaths: s.deaths, timeMs: framesToMs(s.frame), score: s.score() } };
}

describe("dash logic", () => {
  it("generates a seeded endless run per difficulty, graded by difficulty", () => {
    let last = -1;
    for (const d of DIFFICULTIES) {
      const a = logic.generate(createRng(`daily:2026-11-14:${d}`), d);
      expect(logic.generate(createRng(`daily:2026-11-14:${d}`), d)).toEqual(a);
      expect(a.puzzle.levels).toEqual([`run-${d}`]);
      expect(a.puzzle.seed).toBeGreaterThan(0);
      expect(a.solution).toEqual(a.puzzle);
      expect(a.grade).toBeGreaterThan(last);
      last = a.grade;
      expect(createSim(a.puzzle).def.preset).toBe(PRESETS[d as Difficulty]);
      expect(runName(a.puzzle)).toMatch(/^Endless run, /);
    }
    const x = logic.generate(createRng("a"), "easy").puzzle;
    const y = logic.generate(createRng("b"), "easy").puzzle;
    expect(x.seed).not.toBe(y.seed);
  });

  it("verifies an honest run: score = metres, one crash ends it", () => {
    const g = logic.generate(createRng("verify"), "medium");
    const { state } = endlessRun(g.puzzle, 300);
    expect(state.deaths).toBe(1);
    expect(state.score).toBeGreaterThanOrEqual(300);
    const v = logic.verify(g.puzzle, g.solution, state);
    expect(v).toEqual({ ok: true, progress: 1, score: state.score });
    expect(logic.progress(g.puzzle, g.solution, state)).toBeGreaterThan(0.3);
    expect(logic.progress(g.puzzle, g.solution, state)).toBeLessThan(1);
  });

  it("rejects forged scores, crashes and times, tampered logs and other courses", () => {
    const g = logic.generate(createRng("forge"), "hard");
    const { log, state } = endlessRun(g.puzzle, 200);
    const bad = (s: Partial<RageState>, p = g.puzzle) => logic.verify(p, g.solution, { ...state, ...s } as RageState).ok;
    expect(bad({})).toBe(true);
    expect(bad({ score: state.score! + 50 })).toBe(false);
    expect(bad({ score: undefined })).toBe(false);
    expect(bad({ deaths: 0 })).toBe(false);
    expect(bad({ timeMs: state.timeMs - 100 })).toBe(false);
    // the run must end on its crash: a log cut short, or input after the crash, fails
    expect(bad({ log: { ...log, frames: log.frames - 30 } })).toBe(false);
    expect(bad({ log: { ...log, frames: log.frames + 30 } })).toBe(false);
    // skipping the first jump crashes early, so the log no longer ends on the crash
    const first = log.events.findIndex((e) => e[1] & BTN.JUMP);
    const ev = log.events.filter((_, i) => i !== first && i !== first + 1);
    expect(bad({ log: { ...log, events: ev } })).toBe(false);
    expect(bad({}, { ...g.puzzle, seed: (g.puzzle.seed ?? 0) + 1 })).toBe(false);
    expect(bad({}, { levels: ["run-mega"], seed: g.puzzle.seed })).toBe(false);
    expect(bad({ log: null as unknown as InputLog })).toBe(false);
  });

  it("levels: a ladder of 30 fixed runs with climbing goals; a level clears when its goal is reached", () => {
    expect(LEVELS).toHaveLength(30);
    expect(logic.level!(0)).toBeNull();
    expect(logic.level!(31)).toBeNull();
    for (const n of [1, 6, 7, 30]) {
      const g = logic.level!(n)!;
      const l = LEVELS[n - 1];
      expect(g.puzzle).toEqual({ levels: [l.id] });
      const sim = createSim(g.puzzle);
      expect(sim.def.target).toBe(l.target);
      expect(runName(g.puzzle)).toBe(`${l.name}, reach ${l.target} m`);
      const frames = solveRun(sim, 1e9, 4)!;
      expect(frames, l.id).not.toBeNull();
      const r = replay(createSim(g.puzzle), logFromFrames(frames));
      expect(r.ok).toBe(true);
      expect(r.score).toBe(l.target);
      const st: RageState = { log: logFromFrames(frames), deaths: 0, timeMs: r.timeMs, score: r.score };
      expect(logic.verify(g.puzzle, g.solution, st)).toEqual({ ok: true, progress: 1, score: l.target });
    }
    // grades climb along the ladder
    expect(logic.level!(30)!.grade).toBeGreaterThan(logic.level!(1)!.grade);
  });

  it("every level can be cleared (bot with 100 ms decisions)", () => {
    for (const l of LEVELS) expect(solveRun(createSim({ levels: [l.id] }), 1e9, 6), l.id).not.toBeNull();
  });

  it("opens courses and states saved by the old segment-based Dash without crashing", () => {
    const old: CoursePuzzle = { levels: ["warm-up", "mind-the-gap", "pillar-talk"] };
    const sim = createSim(old);
    expect(sim.def.target).toBeUndefined();
    expect(createSim(old).obs).toEqual(sim.obs);
    expect(runName(old)).toBe("Endless run");
    const { state } = endlessRun(old, 100);
    expect(logic.verify(old, { levels: old.levels.slice() }, state).ok).toBe(true);
    // an old state (deaths and time, no score) is dropped by the board; a new one is kept
    expect(freshState({ log: state.log, deaths: 3, timeMs: 9000 })).toBeUndefined();
    expect(freshState(null)).toBeUndefined();
    expect(freshState(state)).toBe(state);
    expect(() => createSim({} as CoursePuzzle)).not.toThrow();
  });
});
