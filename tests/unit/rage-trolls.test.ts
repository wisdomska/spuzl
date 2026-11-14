import { describe, expect, it } from "vitest";
import { compileLevel, type LevelDef, type TrapDef } from "@/phaser/sim/level";
import { BASE_CONFIG, PlatformerCourse, PlatformerWorld } from "@/phaser/sim/platformer";
import { BTN } from "@/phaser/sim/input";
import { TILE } from "@/phaser/sim/fixed";

/** A 16 x 6 room: floor on the bottom two rows, the runner at the left, the door at the right. */
function room(rows: string[], traps: Record<string, TrapDef> = {}, triggers: LevelDef["triggers"] = []): LevelDef {
  return { id: "t", name: "T", tiles: rows, traps, triggers };
}
const AIR = "#..............#";
const FLOOR = "################";
const world = (l: LevelDef) => new PlatformerWorld(compileLevel(l), BASE_CONFIG);

/** Steps `n` frames holding `b`; returns the frame of the first death or -1. */
function run(w: PlatformerWorld, b: number, n: number): number {
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const d = w.deaths;
    w.step(b, prev);
    prev = b;
    if (w.deaths > d) return i;
  }
  return -1;
}

describe("troll traps (opt-in kinds in the shared platformer)", () => {
  it("fake ground looks solid and never holds you", () => {
    const l = room([AIR, AIR, AIR, "#S...........E.#", "#####11#########", "#####11#########"], { "1": { kind: "fake", delay: 0 } });
    const w = world(l);
    expect(w.solidCell(5, 4)).toBe(false);
    expect(run(w, BTN.RIGHT, 300)).toBeGreaterThan(0);
  });

  it("a falling ceiling crushes whoever is under it, then stays down as a step", () => {
    const at = (zx: number) =>
      room(
        [FLOOR, "######11########", AIR, "#S...........E.#", FLOOR, FLOOR],
        { "1": { kind: "move", delay: 0, by: [0, 2], frames: 10, ease: "in" } },
        [{ zone: [zx, 2, 1, 2], fire: ["1"] }],
      );
    expect(run(world(at(6)), BTN.RIGHT, 200)).toBeGreaterThan(0);
    // stop on the trigger, wait it out: alive, and the block now sits on the floor
    const w = world(at(5));
    for (let i = 0; i < 200 && w.fired[0] < 0; i++) w.step(BTN.RIGHT, BTN.RIGHT);
    expect(run(w, 0, 60)).toBe(-1);
    expect(w.solidsIn({ x: 6 * TILE, y: 3 * TILE, w: TILE, h: TILE }).length).toBeGreaterThan(0);
  });

  it("a press with `back` goes home after its rest", () => {
    const l = room(
      [FLOOR, "######11########", AIR, "#S...........E.#", FLOOR, FLOOR],
      { "1": { kind: "move", delay: 0, by: [0, 2], frames: 10, back: 20 } },
      [{ zone: [1, 0, 2, 6], fire: ["1"] }],
    );
    const w = world(l);
    run(w, 0, 15);
    expect(w.groupOffset(0).y).toBe(2 * TILE);
    run(w, 0, 30);
    expect(w.groupOffset(0).y).toBe(0);
  });

  it("a rising floor shoves the runner up into the spikes", () => {
    const l = room(
      [FLOOR, "#vvvv..........#", AIR, "#S...........E.#", "#111############", FLOOR],
      { "1": { kind: "move", delay: 0, by: [0, -3], frames: 40 } },
      [{ zone: [1, 2, 2, 2], fire: ["1"] }],
    );
    expect(run(world(l), 0, 120)).toBeGreaterThan(0);
  });

  it("sliding spikes travel at you; spikes can point out of a wall", () => {
    const slide = room([AIR, AIR, AIR, "#S..........11E#", FLOOR, FLOOR], { "1": { kind: "slide", delay: 0, by: [-10, 0], frames: 30 } }, [
      { zone: [3, 0, 1, 4], fire: ["1"] },
    ]);
    const w = world(slide);
    for (let i = 0; i < 200 && w.fired[0] < 0; i++) w.step(BTN.RIGHT, BTN.RIGHT);
    expect(w.deaths).toBe(0);
    expect(run(w, 0, 60)).toBeGreaterThan(0);
    const spiky = world(room([AIR, AIR, AIR, "#S..<........E.#", FLOOR, FLOOR]));
    expect(spiky.spikeCell(4, 3)).toBe(-2);
    expect(run(spiky, BTN.RIGHT, 100)).toBeGreaterThan(0);
  });

  it("a decoy door is harmless and useless until it bites", () => {
    const l = room([AIR, AIR, AIR, "#S...........E.#", FLOOR, FLOOR], { "1": { kind: "decoy", delay: 0, at: [5, 3] } }, [
      { zone: [7, 0, 1, 4], fire: ["1"] },
    ]);
    const w = world(l);
    // walk through the sleeping decoy: no death, no clear
    for (let i = 0; i < 200 && w.fired[0] < 0; i++) w.step(BTN.RIGHT, BTN.RIGHT);
    expect(w.deaths).toBe(0);
    expect(w.done).toBe(false);
    expect(w.active(0)).toBe(true);
    expect(run(w, BTN.LEFT, 60)).toBeGreaterThan(0);
  });

  it("flip turns gravity over (only inside its zone when it has one)", () => {
    const l = room([FLOOR, AIR, AIR, "#S...........E.#", FLOOR, FLOOR], { "1": { kind: "flip", delay: 0, zone: [4, 0, 4, 6] } }, [
      { zone: [4, 0, 1, 6], fire: ["1"] },
    ]);
    const w = world(l);
    run(w, BTN.RIGHT, 40);
    expect(w.body.g).toBe(-1);
    run(w, BTN.RIGHT, 80);
    expect(w.body.g).toBe(1);
  });

  it("reverse swaps left and right inside its zone", () => {
    const l = room([AIR, AIR, AIR, "#S...........E.#", FLOOR, FLOOR], { "1": { kind: "reverse", delay: 0, zone: [0, 0, 16, 6] } }, [
      { zone: [0, 0, 16, 6], fire: ["1"] },
    ]);
    const w = world(l);
    run(w, 0, 2);
    const x = w.body.x;
    run(w, BTN.RIGHT, 20);
    expect(w.body.x).toBeLessThan(x);
  });

  it("a saw hides until fired, then runs its track and cuts", () => {
    const l = room(
      [AIR, AIR, AIR, "#S...........E.#", FLOOR, FLOOR],
      { "1": { kind: "saw", delay: 0, from: [10, 3], to: [4, 3], period: 60 } },
      [{ zone: [3, 0, 1, 4], fire: ["1"] }],
    );
    const w = world(l);
    expect(w.sawPos(0)).toBeNull();
    expect(run(w, BTN.RIGHT, 200)).toBeGreaterThan(0);
  });

  it("is deterministic: a course with every troll replays the same", () => {
    const l = room(
      [FLOOR, "######11########", AIR, "#S..<......22E.#", "#####33#########", FLOOR],
      {
        "1": { kind: "move", delay: 0, by: [0, 2], frames: 10, ease: "in", back: 10 },
        "2": { kind: "slide", delay: 3, by: [-6, 0], frames: 30 },
        "3": { kind: "fake", delay: 0 },
        "4": { kind: "saw", delay: 0, from: [8, 2], to: [12, 2], period: 40 },
      },
      [{ zone: [2, 0, 1, 6], fire: ["1", "2", "4"] }],
    );
    const go = () => {
      const c = new PlatformerCourse([l], BASE_CONFIG);
      for (let i = 0; i < 400; i++) c.step(i % 7 < 3 ? BTN.RIGHT | BTN.JUMP : BTN.LEFT);
      return [c.deaths, c.world.body.x, c.world.body.y, c.frame];
    };
    expect(go()).toEqual(go());
  });
});
