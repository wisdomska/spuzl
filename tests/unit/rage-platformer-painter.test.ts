import { describe, expect, it } from "vitest";
import { createSim } from "@/games/gotcha/logic";
import { LEVELS } from "@/games/gotcha/levels";
import { BTN } from "@/phaser/sim/input";
import { createPlatformerPainter } from "@/phaser/render/platformer";
import type { DrawCtx, Gfx } from "@/phaser/render/types";

/** A Graphics stand-in that counts calls by name. */
function countingGfx() {
  const calls = new Map<string, number>();
  const gfx = new Proxy({} as Gfx, {
    get: (_t, name: string) => () => {
      calls.set(name, (calls.get(name) ?? 0) + 1);
    },
  });
  return { gfx, calls };
}

function frameCtx() {
  const g = countingGfx();
  const bg = countingGfx();
  const backdrops: [number, number][] = [];
  const ctx: DrawCtx = {
    g: g.gfx,
    bg: bg.gfx,
    label: () => {},
    w: 750,
    h: 420,
    dpr: 2,
    now: 1000,
    reduced: false,
    palette: { rage: 0xff3b3b, gold: 0xffc93c, accent: 0xb8f23a },
    backdrop: (dx, dy) => backdrops.push([dx, dy]),
  };
  return { ctx, g, bg, backdrops };
}

describe("Rage Ridge platformer painter (R4-21)", () => {
  const level = LEVELS[0].id;

  it("draws the backdrop once a frame from the pre-drawn texture, not circle by circle", () => {
    const sim = createSim({ levels: [level] });
    const painter = createPlatformerPainter();
    const f = frameCtx();
    painter.draw(f.ctx, sim, null);
    expect(f.backdrops).toHaveLength(1);
    expect(f.bg.calls.size).toBe(0);
    // The level's own circles (hooks, the exit's trail) are a handful, never a dot grid's few hundred.
    expect(f.g.calls.get("fillCircle") ?? 0).toBeLessThan(40);
  });

  it("scrolls the dot grid with the camera (slow parallax)", () => {
    const sim = createSim({ levels: [level] });
    const painter = createPlatformerPainter();
    const xs: number[] = [];
    for (let i = 0; i < 240; i++) {
      sim.step(BTN.RIGHT);
      const f = frameCtx();
      f.ctx.now = 1000 + i * 16;
      painter.draw(f.ctx, sim, null);
      xs.push(f.backdrops[0][0]);
      expect(f.backdrops[0][1]).toBe(0);
    }
    // Running right moves the camera right, so the grid shifts left (never right).
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeLessThanOrEqual(xs[i - 1] + 1e-9);
  });

  it("keeps drawing the same frame for the same sim (no state leaks between frames)", () => {
    const sim = createSim({ levels: [level] });
    const painter = createPlatformerPainter();
    const a = frameCtx();
    painter.draw(a.ctx, sim, null);
    const b = frameCtx();
    painter.draw(b.ctx, sim, null);
    expect([...b.g.calls]).toEqual([...a.g.calls]);
  });
});
