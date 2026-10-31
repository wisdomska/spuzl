import { describe, expect, it } from "vitest";
import { HeldInput } from "@/phaser/held";
import { stageHeight } from "@/phaser/layout";
import { RageController } from "@/phaser/controller";
import { BTN } from "@/phaser/sim/input";
import { STEP_MS } from "@/phaser/sim/fixed";
import type { SimCore } from "@/phaser/sim/core";

function track() {
  const calls: [string, number, boolean][] = [];
  const now: Record<string, number> = {};
  const h = new HeldInput((src, bits, down) => {
    calls.push([src, bits, down]);
    now[src] = bits;
  });
  return { h, calls, now };
}

describe("HeldInput", () => {
  it("keeps every held key applied until its own keyup", () => {
    const { h, now } = track();
    h.keyDown("ArrowRight");
    h.keyDown("Space"); // auto-repeat now only re-sends Space; Right must stay held
    expect(now.key).toBe(BTN.RIGHT | BTN.JUMP);
    h.keyDown("Space"); // repeat
    expect(now.key).toBe(BTN.RIGHT | BTN.JUMP);
    h.keyUp("Space");
    expect(now.key).toBe(BTN.RIGHT);
    h.keyUp("ArrowRight");
    expect(now.key).toBe(0);
  });

  it("ignores keys the game does not use", () => {
    const { h, calls } = track();
    expect(h.keyDown("KeyQ")).toBe(false);
    h.keyUp("KeyQ");
    expect(calls).toHaveLength(0);
  });

  it("repeats re-apply as presses", () => {
    const { h, calls } = track();
    h.keyDown("KeyA");
    h.keyDown("KeyA");
    expect(calls).toEqual([
      ["key", BTN.LEFT, true],
      ["key", BTN.LEFT, true],
    ]);
  });

  it("holds a control while any pointer is down, releasing once on up, cancel or lost capture", () => {
    const { h, calls, now } = track();
    h.pointerDown("pl", 1, BTN.LEFT);
    h.pointerDown("pl", 2, BTN.LEFT);
    h.pointerUp("pl", 1);
    expect(now.pl).toBe(BTN.LEFT);
    h.pointerUp("pl", 2); // pointercancel
    h.pointerUp("pl", 2); // lostpointercapture after it
    expect(now.pl).toBe(0);
    expect(calls.filter((c) => c[0] === "pl" && c[1] === 0)).toHaveLength(1);
  });

  it("drag changes the held buttons without releasing", () => {
    const { h, now } = track();
    h.pointerDown("canvas", 7, 0);
    h.pointerSet("canvas", 7, BTN.RIGHT);
    expect(now.canvas).toBe(BTN.RIGHT);
    expect(h.held("canvas")).toBe(true);
    h.pointerSet("canvas", 8, BTN.LEFT); // another pointer is ignored
    expect(now.canvas).toBe(BTN.RIGHT);
  });

  it("blur releases keys and pointers", () => {
    const { h, now } = track();
    h.keyDown("ArrowLeft");
    h.pointerDown("pj", 3, BTN.JUMP);
    h.releaseAll();
    expect(now).toEqual({ key: 0, pj: 0 });
    expect(h.held("key")).toBe(false);
    expect(h.held("pj")).toBe(false);
  });

  it("a held control applies on every fixed step until release", () => {
    const seen: number[] = [];
    const fake = { frame: 0, finished: false, ev: 0, deaths: 0, progress: () => 0, cleared: () => 0, score: () => 0 };
    const sim = {
      ...fake,
      step(b: number) {
        seen.push(b);
        sim.frame++;
      },
    } as unknown as SimCore;
    const ctl = new RageController(sim);
    const h = new HeldInput((src, bits) => ctl.setSource(src, bits));
    h.pointerDown("pr", 1, BTN.RIGHT);
    for (let i = 0; i < 30; i++) ctl.tick(STEP_MS);
    h.pointerUp("pr", 1);
    for (let i = 0; i < 5; i++) ctl.tick(STEP_MS);
    expect(seen.slice(0, 30).every((b) => b === BTN.RIGHT)).toBe(true);
    expect(seen.slice(30).every((b) => b === 0)).toBe(true);
  });
});

describe("stageHeight", () => {
  it("fills at least 60 % of a 375 x 812 phone", () => {
    expect(stageHeight(339, { w: 375, h: 812 })).toBeGreaterThanOrEqual(0.6 * 812);
    expect(stageHeight(339, { w: 375, h: 812 }, true)).toBeGreaterThanOrEqual(0.6 * 812);
    expect(stageHeight(284, { w: 320, h: 568 })).toBeGreaterThanOrEqual(0.6 * 568);
  });

  it("keeps the width-based size on desktop and landscape", () => {
    expect(stageHeight(524, { w: 1280, h: 800 })).toBe(320);
    expect(stageHeight(524, { w: 1280, h: 800 }, true)).toBe(400);
    expect(stageHeight(339, { w: 812, h: 375 })).toBe(237);
  });
});
