import { describe, expect, it } from "vitest";
import { approach, clamp, framesToMs, idiv, isqrt, STEP_MS, TILE } from "@/phaser/sim/fixed";
import { BTN, framesFromLog, LogRecorder, logFromFrames, logFromScript, readerFor, scriptFromLog, validateLog } from "@/phaser/sim/input";
import { compileLevel, type LevelDef } from "@/phaser/sim/level";
import { BASE_CONFIG, PlatformerCourse } from "@/phaser/sim/platformer";
import { deathsRankScore, EV, replay } from "@/phaser/sim/core";
import { beamSearch, solvePlatformer } from "@/phaser/sim/solver";
import { buildGhost, RageController } from "@/phaser/controller";

const flat = (extra: Partial<LevelDef> = {}, row6 = ".S..........E.", floor = "##############"): LevelDef => ({
  id: "t",
  name: "Test",
  tiles: ["..............", "..............", "..............", "..............", "..............", "..............", row6, floor, floor],
  ...extra,
});

/** Random but reproducible button mash (xorshift, test only). */
function mash(seed: number, n: number): number[] {
  let s = seed;
  const out: number[] = [];
  let b = 0;
  for (let i = 0; i < n; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    if (i % 7 === 0) b = (s >>> 0) % 8;
    out.push(b);
  }
  return out;
}

describe("fixed point", () => {
  it("integer helpers are exact", () => {
    for (const n of [0, 1, 2, 3, 4, 15, 16, 17, 99, 100, 2 ** 40 + 5]) {
      const r = isqrt(n);
      expect(r * r).toBeLessThanOrEqual(n);
      expect((r + 1) * (r + 1)).toBeGreaterThan(n);
    }
    expect(isqrt(-4)).toBe(0);
    expect(idiv(-7, 2)).toBe(-3);
    expect(idiv(7, 2)).toBe(3);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(10, 0, 3)).toBe(7);
    expect(approach(4, 4, 3)).toBe(4);
    expect(framesToMs(60)).toBe(1000);
    expect(deathsRankScore(0, 10_000)).toBeGreaterThan(deathsRankScore(1, 1_000));
  });
});

describe("input logs", () => {
  it("round-trips frames, scripts and recorders", () => {
    const frames = mash(7, 500);
    const log = logFromFrames(frames);
    expect(log.step).toBe(STEP_MS);
    expect(framesFromLog(log)).toEqual(frames);
    expect(logFromScript(scriptFromLog(log))).toEqual(log);
    expect(LogRecorder.from(log).toLog()).toEqual(log);
    const at = readerFor(log);
    expect(frames.every((b, i) => at(i) === b)).toBe(true);
    expect(validateLog(log)).toBeNull();
  });

  it("rejects malformed logs", () => {
    const ok = logFromFrames([1, 1, 0]);
    expect(validateLog(null)).toBe("log missing");
    expect(validateLog({ ...ok, step: 16 })).toBe("bad step");
    expect(validateLog({ ...ok, frames: 0 })).toBe("bad frame count");
    expect(validateLog({ ...ok, frames: 1.5 })).toBe("bad frame count");
    expect(validateLog({ ...ok, events: "x" })).toBe("bad events");
    expect(validateLog({ ...ok, events: [[0]] })).toBe("bad event");
    expect(validateLog({ ...ok, events: [[0.5, 1]] })).toBe("bad event");
    expect(
      validateLog({
        ...ok,
        events: [
          [2, 1],
          [1, 0],
        ],
      }),
    ).toBe("events out of order");
    expect(validateLog({ ...ok, events: [[9, 1]] })).toBe("events out of order");
    expect(validateLog({ ...ok, events: [[0, 16]] })).toBe("bad buttons");
    expect(validateLog({ ...ok, frames: 10 }, 5)).toBe("bad frame count");
  });
});

describe("level format", () => {
  it("compiles traps, triggers, hooks and platforms", () => {
    const l = compileLevel(
      flat(
        {
          traps: { "1": { kind: "drop", delay: 2 }, "2": { kind: "exit", delay: 0, to: [3, 6], frames: 10 } },
          triggers: [{ zone: [2, 5, 1, 2], fire: ["1", "2"] }],
          platforms: [{ w: 2, from: [1, 3], to: [5, 3], period: 60 }],
        },
        ".S.H........E.",
        "####11########",
      ),
    );
    expect(l.traps.map((t) => t.id)).toEqual(["1", "2"]);
    expect(l.traps[0].cells.length).toBe(4);
    expect(l.hooks).toEqual([{ x: 3, y: 6 }]);
    expect(l.triggers[0].fire).toEqual([0, 1]);
    expect(l.start).toEqual({ x: 1, y: 6 });
  });

  it("refuses broken levels", () => {
    expect(() => compileLevel(flat({}, ".S..........E"))).toThrow(/width/);
    expect(() => compileLevel(flat({}, "..............")).toString()).toThrow(/start/);
    expect(() => compileLevel(flat({}, ".S............"))).toThrow(/exit/);
    expect(() => compileLevel(flat({}, ".S....?.....E."))).toThrow(/unknown/);
    expect(() => compileLevel(flat({}, ".S..1.......E."))).toThrow(/undefined trap/);
    expect(() => compileLevel(flat({ traps: { "1": { kind: "drop", delay: 1 } } }))).toThrow(/no cells/);
    expect(() => compileLevel(flat({ traps: { "1": { kind: "exit", delay: 1 } } }))).toThrow(/exit trap/);
    expect(() => compileLevel(flat({ traps: { "1": { kind: "spikes", delay: -1 } } }, ".S..1.......E."))).toThrow(/negative/);
    expect(() => compileLevel(flat({ triggers: [{ zone: [0, 0, 1, 1], fire: ["7"] }] }))).toThrow(/undefined trap/);
    expect(() => compileLevel(flat({ platforms: [{ w: 1, from: [0, 0], to: [1, 0], period: 7 }] }))).toThrow(/even/);
  });
});

describe("platformer sim", () => {
  it("is deterministic: the same log gives the same result, frame by frame", () => {
    const lvl = flat(
      { traps: { "1": { kind: "drop", delay: 3 } }, triggers: [{ zone: [5, 4, 2, 3], fire: ["1"] }] },
      ".S..........E.",
      "#####11#######",
    );
    for (let seed = 1; seed < 6; seed++) {
      const frames = mash(seed, 900);
      const a = new PlatformerCourse([lvl], BASE_CONFIG);
      const b = new PlatformerCourse([lvl], BASE_CONFIG);
      for (const f of frames) {
        a.step(f);
        b.step(f);
        expect(a.world.body).toEqual(b.world.body);
      }
      expect(a.deaths).toBe(b.deaths);
      expect(a.finished).toBe(b.finished);
    }
  });

  it("runs, jumps, lands and reaches the exit", () => {
    const c = new PlatformerCourse([flat()], BASE_CONFIG);
    let ev = 0;
    for (let i = 0; i < 400 && !c.finished; i++) {
      c.step(BTN.RIGHT | (i === 20 ? BTN.JUMP : 0));
      ev |= c.ev;
    }
    expect(c.finished).toBe(true);
    expect(ev & EV.JUMP).toBeTruthy();
    expect(ev & EV.LAND).toBeTruthy();
    expect(c.progress()).toBe(1);
    expect(c.splits.length).toBe(1);
  });

  it("dies on spikes and falls, respawns after 300 ms with traps re-armed", () => {
    const c = new PlatformerCourse([flat({}, ".S...^......E.")], BASE_CONFIG);
    let i = 0;
    while (!c.deaths && i++ < 300) c.step(BTN.RIGHT);
    expect(c.deaths).toBe(1);
    expect(c.world.dead).toBe(BASE_CONFIG.respawnFrames);
    for (let k = 0; k < BASE_CONFIG.respawnFrames; k++) c.step(0);
    expect(c.ev & EV.RESPAWN).toBeTruthy();
    expect(c.world.telegraph).toBe(true);
    const pit = new PlatformerCourse([flat({}, ".S..........E.", "#####..#######")], BASE_CONFIG);
    for (let k = 0; k < 300 && !pit.deaths; k++) pit.step(BTN.RIGHT);
    expect(pit.deaths).toBe(1);
  });

  it("flips gravity, swings on a rope and climbs holds", () => {
    const flip = new PlatformerCourse(
      [
        flat({
          tiles: [
            "##############",
            "..............",
            "..............",
            "..............",
            "..............",
            "..............",
            ".S..........E.",
            "##############",
            "##############",
          ],
        }),
      ],
      { ...BASE_CONFIG, flip: true, autorun: true, variableJump: false },
    );
    flip.step(0);
    flip.step(BTN.JUMP);
    expect(flip.ev & EV.FLIP).toBeTruthy();
    for (let i = 0; i < 40; i++) flip.step(BTN.JUMP);
    expect(flip.world.body.g).toBe(-1);
    expect(flip.world.body.grounded, "flip").toBe(true);

    const hookLvl = flat({
      tiles: [
        "..............",
        "......H.......",
        "..............",
        "..............",
        "..............",
        "..............",
        ".S..........E.",
        "#####...######",
        "#####...######",
      ],
    });
    const grapple = new PlatformerCourse([hookLvl], { ...BASE_CONFIG, rope: "hold", autorun: true });
    let grabbed = false;
    for (let i = 0; i < 200 && !grapple.finished && !grapple.deaths; i++) {
      grapple.step(i > 10 && i < 70 ? BTN.JUMP : 0);
      if (grapple.ev & EV.GRAB) grabbed = true;
    }
    expect(grabbed, "grapple").toBe(true);

    const climb = new PlatformerCourse(
      [
        flat({
          tiles: [
            "..............",
            "..............",
            "..............",
            "..............",
            "....H.........",
            "..............",
            ".S..........E.",
            "##############",
            "##############",
          ],
        }),
      ],
      { ...BASE_CONFIG, rope: "climb" },
    );
    let held = false;
    for (let i = 0; i < 120; i++) {
      climb.step(i < 30 ? BTN.RIGHT | (i > 22 ? BTN.JUMP : 0) : BTN.RIGHT);
      if (climb.world.body.hook >= 0) held = true;
    }
    expect(held, "climb").toBe(true);
    climb.step(0);
    climb.step(BTN.JUMP);
  });

  it("carries the runner on moving platforms and runs the door", () => {
    const lvl = flat(
      {
        platforms: [{ w: 2, from: [2, 7], to: [8, 7], period: 120 }],
        traps: { "1": { kind: "exit", delay: 0, to: [2, 6], frames: 20 } },
        triggers: [{ zone: [10, 4, 1, 3], fire: ["1"] }],
      },
      ".S..........E.",
      "##..........##",
    );
    const c = new PlatformerCourse([lvl], BASE_CONFIG);
    c.step(BTN.RIGHT);
    expect(c.world.body.plat === -1 || c.world.body.plat === 0).toBe(true);
    const sol = solvePlatformer(c.clone());
    expect(sol).not.toBeNull();
    const r = replay(new PlatformerCourse([lvl], BASE_CONFIG), logFromFrames([BTN.RIGHT, ...sol!]));
    expect(r.deaths).toBe(0);
  });

  it("a block trap that appears inside the runner crushes it", () => {
    const lvl = flat({ traps: { "1": { kind: "block", delay: 0 } }, triggers: [{ zone: [3, 6, 1, 1], fire: ["1"] }] }, ".S.1........E.");
    const c = new PlatformerCourse([lvl], BASE_CONFIG);
    for (let i = 0; i < 200 && !c.deaths; i++) c.step(BTN.RIGHT);
    expect(c.deaths).toBe(1);
  });

  it("courses chain levels with a pause, and replay refuses unfinished runs", () => {
    const c = new PlatformerCourse([flat(), flat()], BASE_CONFIG);
    const frames: number[] = [];
    while (!c.finished && frames.length < 2000) {
      c.step(BTN.RIGHT);
      frames.push(BTN.RIGHT);
    }
    expect(c.cleared()).toBe(2);
    expect(c.metres()).toBeGreaterThan(14);
    const ok = replay(new PlatformerCourse([flat(), flat()], BASE_CONFIG), logFromFrames(frames));
    expect(ok.ok).toBe(true);
    const short = replay(new PlatformerCourse([flat(), flat()], BASE_CONFIG), logFromFrames(frames.slice(0, 100)));
    expect(short.ok).toBe(false);
    expect(short.reason).toBe("course not finished");
  });

  it("beam search gives up on impossible rooms", () => {
    const wall = flat({
      tiles: [
        "..............",
        "..............",
        "..............",
        ".......#......",
        ".......#......",
        ".......#......",
        ".S.....#....E.",
        "##############",
        "##############",
      ],
    });
    expect(solvePlatformer(new PlatformerCourse([wall], BASE_CONFIG), { maxFrames: 400 })).toBeNull();
    expect(
      beamSearch(new PlatformerCourse([wall], BASE_CONFIG), {
        actions: [0],
        macro: 4,
        beam: 4,
        maxFrames: 8,
        heuristic: () => 0,
        key: () => "k",
      }),
    ).toBeNull();
  });
});

describe("controller", () => {
  it("steps at a fixed rate, records the log and replays a ghost", () => {
    const mk = () => new PlatformerCourse([flat()], BASE_CONFIG);
    const ctl = new RageController(mk());
    let started = 0;
    let finished = 0;
    ctl.setHooks({ onStart: () => started++, onFinish: () => finished++ });
    expect(ctl.tick(100)).toBe(0); // not started
    ctl.setSource("key", BTN.RIGHT);
    expect(started).toBe(1);
    for (let i = 0; i < 200 && !ctl.sim.finished; i++) ctl.tick(STEP_MS);
    expect(finished).toBe(1);
    const log = ctl.log();
    expect(replay(mk(), log).ok).toBe(true);
    const ghost = buildGhost("Kofi", mk, log);
    const racer = new RageController(mk());
    racer.setGhost(ghost);
    racer.setSource("key", BTN.RIGHT);
    for (let i = 0; i < 40; i++) racer.tick(STEP_MS);
    expect(Math.abs(racer.ghostDelta()!)).toBeLessThan(0.2);
    const resumed = new RageController(mk());
    resumed.restore(logFromFrames(new Array(30).fill(BTN.RIGHT)));
    expect(resumed.sim.frame).toBe(30);
    resumed.setPaused(true);
    expect(resumed.tick(100)).toBe(0);
    resumed.clearSources();
    expect(resumed.buttons()).toBe(0);
    expect(TILE).toBe(4096);
  });
});
