/** Painter for Ricochet: the arena, wall spikes sliding in after each bounce, the score behind, Spuz. */
import { EV } from "../sim/core";
import { FP } from "../sim/fixed";
import { BIRD, STRIP, type RicochetSim } from "../sim/ricochet";
import { burst, drawSpuz, type Particle } from "./spuz";
import { SCENE, type Painter } from "./types";

export function createRicochetPainter(): Painter<RicochetSim> {
  let parts: Particle[] = [];
  let deathAt = -1e9;
  return {
    onEvents(ev, sim, now) {
      if (ev & EV.DEATH) {
        deathAt = now;
        parts = burst((sim.x + BIRD / 2) / FP, (sim.y + BIRD / 2) / FP, now, 1, [SCENE.spuz, 0xff3b3b, SCENE.white]);
      }
    },
    draw(ctx, sim) {
      const { g, w, h, now, reduced, palette } = ctx;
      const a = sim.a;
      const s = Math.min((h * 0.94) / a.h, (w * 0.92) / a.w);
      const ox = (w - a.w * s) / 2,
        oy = (h - a.h * s) / 2 + h * 0.02;
      const X = (px: number) => ox + px * s;
      const Y = (py: number) => oy + py * s;
      ctx.bg.fillStyle(SCENE.bg, 1);
      ctx.bg.fillRect(0, 0, w, h);
      ctx.bg.fillStyle(SCENE.dot, 1);
      const step = 20 * ctx.dpr;
      for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) ctx.bg.fillCircle(x, y, 1.5 * ctx.dpr);
      // walls
      g.fillStyle(SCENE.ground, 1);
      g.fillRoundedRect(X(0) - 8 * s, Y(0), 8 * s, a.h * s, { tl: 4 * s, tr: 0, bl: 4 * s, br: 0 });
      g.fillRoundedRect(X(a.w), Y(0), 8 * s, a.h * s, { tl: 0, tr: 4 * s, bl: 0, br: 4 * s });
      // score behind the action
      ctx.label("score", String(sim.points), w / 2, h / 2 + 40 * ctx.dpr, { color: "#3A1A22", size: 96, weight: 900, behind: true });
      // top and bottom spike strips
      g.fillStyle(palette.rage, 1);
      const n = Math.floor(a.w / 10);
      for (let i = 0; i < n; i++) {
        const x0 = X((i * a.w) / n),
          x1 = X(((i + 1) * a.w) / n);
        g.fillTriangle(x0, Y(0), x1, Y(0), (x0 + x1) / 2, Y(STRIP));
        g.fillTriangle(x0, Y(a.h), x1, Y(a.h), (x0 + x1) / 2, Y(a.h - STRIP));
      }
      // wall spikes slide in over 8 frames after a bounce
      const slide = reduced ? 1 : Math.min(1, (sim.frame - sim.bounceAt) / 8);
      const sh = sim.slotH() / FP;
      sim.walls.forEach((wall, side) => {
        wall.forEach((spiky, i) => {
          if (!spiky) return;
          const k = side === (sim.vx > 0 ? 1 : 0) ? slide : 1;
          const y0 = Y(STRIP + i * sh + 1),
            y1 = Y(STRIP + (i + 1) * sh - 1);
          const depth = 11 * s * k;
          const bx = side === 0 ? X(0) : X(a.w);
          const tip = side === 0 ? bx + depth : bx - depth;
          g.fillTriangle(bx, y0, bx, y1, tip, (y0 + y1) / 2);
        });
      });
      // Spuz
      const cx = X((sim.x + BIRD / 2) / FP),
        feet = Y((sim.y + BIRD) / FP);
      const dead = sim.deaths > 0;
      if (!dead || (!reduced && now - deathAt < 160)) {
        const k = dead ? Math.min(1, (now - deathAt) / 90) : 0;
        drawSpuz(g, {
          x: cx,
          feet,
          size: (BIRD / FP) * s,
          facing: sim.vx > 0 ? 1 : -1,
          up: 1,
          scaleY: 1 - 0.5 * k,
          color: SCENE.spuz,
          alpha: dead ? 1 - (now - deathAt) / 200 : 1,
          mood: sim.vy < 0 ? 0 : 1,
        });
      }
      if (!reduced) {
        parts = parts.filter((p) => now - p.born < 500);
        for (const p of parts) {
          const t = (now - p.born) / 1000,
            f = t * 60;
          g.fillStyle(p.color, 1 - t / 0.5);
          g.fillRect(X(p.x + p.vx * f) - p.size * s * 0.5, Y(p.y + p.vy * f + 0.175 * f * f) - p.size * s * 0.5, p.size * s, p.size * s);
        }
      }
    },
  };
}
