/** Painter for Stacked: the tower scrolls up as it grows, cut pieces fall away, perfect drops pulse once. */
import { EV } from "../sim/core";
import { FP } from "../sim/fixed";
import { BLOCK_H, type StackedSim } from "../sim/stacked";
import { drawSpuz } from "./spuz";
import { SCENE, type Painter } from "./types";

const BLOCKS = [0xff3b3b, 0xffc93c, 0xb8f23a, 0x2fd3e0, 0xff8a3d, 0x8b7cff];

export function createStackedPainter(): Painter<StackedSim> {
  let cutAt = -1e9;
  let perfectAt = -1e9;
  let cam = NaN;
  return {
    onEvents(ev, _sim, now) {
      if (ev & (EV.CUT | EV.DEATH)) cutAt = now;
      if (ev & EV.PERFECT) perfectAt = now;
    },
    draw(ctx, sim) {
      const { g, w, h, now, reduced } = ctx;
      const W = sim.t.w;
      const s = (w * 0.86) / W;
      const ox = (w - W * s) / 2;
      const bh = (BLOCK_H / FP) * s;
      const n = sim.tower.length;
      // the sliding row sits 35% down the canvas
      const target = n * bh - h * 0.65;
      cam = Number.isNaN(cam) || reduced ? target : cam + (target - cam) * 0.15;
      const rowY = (i: number) => h - (i + 1) * bh + Math.max(0, cam);
      ctx.bg.fillStyle(SCENE.bg, 1);
      ctx.bg.fillRect(0, 0, w, h);
      ctx.bg.fillStyle(SCENE.dot, 1);
      const step = 20 * ctx.dpr;
      const off = (Math.max(0, cam) * 0.3) % step;
      for (let y = off; y < h; y += step) for (let x = step / 2; x < w; x += step) ctx.bg.fillCircle(x, y, 1.5 * ctx.dpr);
      const block = (i: number, x: number, bw: number, color: number, alpha = 1, dy = 0) => {
        const y = rowY(i) + dy;
        if (y > h || y + bh < 0) return;
        g.fillStyle(color, alpha);
        g.fillRoundedRect(ox + (x / FP) * s, y + 1, (bw / FP) * s, bh - 2, 3 * ctx.dpr);
        g.fillStyle(SCENE.ink, 0.18 * alpha);
        g.fillRect(ox + (x / FP) * s, y + bh * 0.62, (bw / FP) * s, bh * 0.38 - 1);
      };
      sim.tower.forEach((b, i) => block(i, b.x, b.w, i === 0 ? SCENE.ledge : BLOCKS[(i - 1) % BLOCKS.length]));
      // perfect: one soft pulse around the new top block
      const tp = now - perfectAt;
      if (!reduced && tp < 400 && n > 1) {
        const top = sim.tower[n - 1];
        g.lineStyle(2 * ctx.dpr, SCENE.white, 1 - tp / 400);
        g.strokeRoundedRect(ox + (top.x / FP) * s - 3, rowY(n - 1) - 2, (top.w / FP) * s + 6, bh + 2, 4 * ctx.dpr);
      }
      // the falling cut-off piece
      const tc = now - cutAt;
      if (sim.cut && tc < 700) {
        const fall = reduced ? 0 : 0.0012 * tc * tc * ctx.dpr;
        const row = sim.finished && sim.deaths ? n : n - 1;
        block(row, sim.cut.x, sim.cut.w, BLOCKS[(row - 1 + BLOCKS.length) % BLOCKS.length], reduced ? 0.6 : 1 - tc / 700, fall);
      }
      if (!sim.finished) {
        block(n, sim.x, sim.w, BLOCKS[(n - 1) % BLOCKS.length]);
        drawSpuz(g, {
          x: ox + ((sim.x + sim.w / 2) / FP) * s,
          feet: rowY(n) + 1,
          size: 12 * s,
          facing: sim.v > 0 ? 1 : -1,
          up: 1,
          scaleY: 1,
          color: SCENE.spuz,
          alpha: 1,
          mood: 0,
        });
      } else {
        const top = sim.tower[n - 1];
        drawSpuz(g, {
          x: ox + ((top.x + top.w / 2) / FP) * s,
          feet: rowY(n - 1) + 1,
          size: 12 * s,
          facing: 1,
          up: 1,
          scaleY: sim.deaths ? 0.6 : 1,
          color: SCENE.spuz,
          alpha: 1,
          mood: 1,
        });
      }
      ctx.label("height", `${sim.score()}`, w / 2, h * 0.3 + 40 * ctx.dpr, { color: "#3A1A22", size: 96, weight: 900, behind: true });
    },
  };
}
