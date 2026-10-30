/** Painter for Wobble: rope, poles, the walker with its balance pole, wind streaks and a lean meter. */
import { EV } from "../sim/core";
import { FP } from "../sim/fixed";
import { LEAN_LIMIT, type WobbleSim } from "../sim/wobble";
import { burst, drawSpuz, type Particle } from "./spuz";
import { SCENE, type Painter } from "./types";

export function createWobblePainter(): Painter<WobbleSim> {
  let parts: Particle[] = [];
  let deathAt = -1e9;
  let respawnAt = -1e9;
  let deathLean = 0;
  return {
    onEvents(ev, sim, now) {
      if (ev & EV.DEATH) {
        deathAt = now;
        deathLean = Math.sign(sim.lean);
        parts = burst(sim.pos / FP + deathLean * 10, -10, now, 1, [SCENE.spuz, 0xff3b3b, SCENE.white]);
      }
      if (ev & EV.RESPAWN) respawnAt = now;
    },
    draw(ctx, sim) {
      const { g, w, h, now, reduced, palette } = ctx;
      const r = sim.rope();
      const s = h / 150;
      const viewW = w / s;
      const px = sim.pos / FP;
      const camX = Math.max(-40, Math.min(r.length + 40 - viewW, px - viewW * 0.35));
      const ropeY = h * 0.62;
      const X = (wx: number) => (wx - camX) * s;
      ctx.bg.fillStyle(SCENE.bg, 1);
      ctx.bg.fillRect(0, 0, w, h);
      ctx.bg.fillStyle(SCENE.dot, 1);
      const step = 20 * ctx.dpr;
      const off = (-(camX * s) * 0.3) % step;
      for (let y = step / 2; y < h; y += step) for (let x = off; x < w; x += step) ctx.bg.fillCircle(x, y, 1.5 * ctx.dpr);
      // poles and the rope (a slight sag under the walker)
      g.fillStyle(SCENE.ledge, 1);
      for (const x of [0, r.length])
        g.fillRoundedRect(X(x) - 5 * s, ropeY - 4 * s, 10 * s, h - ropeY + 8 * s, { tl: 3 * s, tr: 3 * s, bl: 0, br: 0 });
      g.lineStyle(Math.max(2, 1.6 * s), 0xe9d8c4, 1);
      const sag = 4 * s;
      const pts = 24;
      for (let i = 0; i < pts; i++) {
        const a = (i / pts) * r.length,
          b = ((i + 1) / pts) * r.length;
        const ya = ropeY + sag * Math.exp(-(((a - px) / 60) ** 2)),
          yb = ropeY + sag * Math.exp(-(((b - px) / 60) ** 2));
        g.lineBetween(X(a), ya, X(b), yb);
      }
      // wind: streaks now, chevrons for a gust coming within 40 frames
      const wind = sim.wind();
      if (wind && !reduced) {
        g.lineStyle(Math.max(1, s), SCENE.white, 0.22);
        for (let i = 0; i < 7; i++) {
          const y = h * (0.12 + i * 0.07);
          const span = w * 0.18;
          const x = (((((now / 3) * Math.sign(wind) + i * 97) % (w + span)) + w + span) % (w + span)) - span / 2;
          g.lineBetween(x, y, x + span * 0.6, y);
        }
      }
      const next = sim.gusts[sim.idx].find((gu) => gu.at > sim.t && gu.at - sim.t < 40);
      if (next) {
        g.lineStyle(2 * s * 0.6, palette.gold, 0.85);
        const d = Math.sign(next.force);
        for (let i = 0; i < 3; i++) {
          const cx = w / 2 + (i - 1) * 14 * s,
            cy = h * 0.34;
          g.lineBetween(cx - d * 4 * s, cy - 5 * s, cx + d * 2 * s, cy);
          g.lineBetween(cx + d * 2 * s, cy, cx - d * 4 * s, cy + 5 * s);
        }
      }
      // walker
      const lean = sim.lean / LEAN_LIMIT;
      const cx = X(px);
      const size = 14 * s;
      if (sim.dead) {
        const t = now - deathAt;
        if (!reduced && t < 400) {
          const fall = 0.002 * t * t * ctx.dpr;
          drawSpuz(g, {
            x: cx + deathLean * 12 * s,
            feet: ropeY + fall,
            size,
            facing: 1,
            up: 1,
            scaleY: t < 90 ? 1 - (0.5 * t) / 90 : 0.5,
            color: SCENE.spuz,
            alpha: 1 - t / 400,
            mood: 1,
          });
        }
      } else {
        const fade = reduced ? 1 : Math.min(1, (now - respawnAt) / 300);
        const shift = lean * 6 * s;
        drawSpuz(g, {
          x: cx + shift,
          feet: ropeY,
          size,
          facing: 1,
          up: 1,
          scaleY: 1,
          color: SCENE.spuz,
          alpha: fade,
          mood: Math.abs(lean) > 0.6 ? 1 : 0,
        });
        const ang = lean * 0.9;
        const L = 26 * s,
          hy = ropeY - size * 0.45;
        g.lineStyle(Math.max(2, 1.4 * s), palette.gold, fade);
        g.lineBetween(cx + shift - Math.cos(ang) * L, hy - Math.sin(ang) * L, cx + shift + Math.cos(ang) * L, hy + Math.sin(ang) * L);
      }
      if (!reduced) {
        parts = parts.filter((p) => now - p.born < 500);
        for (const p of parts) {
          const t = (now - p.born) / 1000,
            f = t * 60;
          g.fillStyle(p.color, 1 - t / 0.5);
          g.fillRect(
            X(p.x + p.vx * f) - p.size * s * 0.5,
            ropeY + (p.y + p.vy * f + 0.175 * f * f) * s - p.size * s * 0.5,
            p.size * s,
            p.size * s,
          );
        }
      }
      // lean meter: red ends, white marker
      const mw = Math.min(w * 0.5, 220 * ctx.dpr),
        mx = (w - mw) / 2,
        my = h - 18 * ctx.dpr,
        mh = 8 * ctx.dpr;
      g.fillStyle(0x2b2f4a, 1);
      g.fillRoundedRect(mx, my, mw, mh, mh / 2);
      g.fillStyle(palette.rage, 0.9);
      g.fillRoundedRect(mx, my, mw * 0.15, mh, { tl: mh / 2, bl: mh / 2, tr: 0, br: 0 });
      g.fillRoundedRect(mx + mw * 0.85, my, mw * 0.15, mh, { tl: 0, bl: 0, tr: mh / 2, br: mh / 2 });
      g.fillStyle(SCENE.white, 1);
      const mk = mx + mw / 2 + Math.max(-1, Math.min(1, lean)) * (mw / 2);
      g.fillRoundedRect(mk - 3 * ctx.dpr, my - 4 * ctx.dpr, 6 * ctx.dpr, mh + 8 * ctx.dpr, 3 * ctx.dpr);
    },
  };
}
