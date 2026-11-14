/**
 * Painter for Dash (phaser/sim/runner.ts). A small Spuz on a long ground line, with as much track ahead as the
 * canvas allows: the world scale follows the canvas width (1 to 1.5 css px per world px), so a phone shows about
 * 250 px of track ahead and a computer more. Sky, a far skyline and a near row of round trees scroll at 0.12 and
 * 0.35 of the ground's speed; the sky moves from evening to dusk (light theme: day to sunset) as the run speeds
 * up. The HUD (metres, best or goal, speed pips, ghost) is drawn in the canvas. Reduced motion: no parallax, no
 * squash and stretch, no shake, no rotor blur; only the track itself scrolls.
 */
import { EV } from "../sim/core";
import { FP } from "../sim/fixed";
import { BODY, KIND, M_PX, type Obstacle, type RunnerSim } from "../sim/runner";
import { burst, drawParticles, drawSpuz, type Particle } from "./spuz";
import { SCENE, type DrawCtx, type Gfx, type Painter } from "./types";

interface Theme {
  skyTop: [number, number];
  skyLow: [number, number];
  far: number;
  mid: number;
  ground: number;
  groundDeep: number;
  tick: number;
  pit: number;
  line: number;
  sun: number;
  ink: string;
  stars: boolean;
}

/** [slow, fast] pairs blend with the run's pace. */
const DARK: Theme = {
  skyTop: [0x14152a, 0x24163a],
  skyLow: [0x20233a, 0x4a2640],
  far: 0x262a45,
  mid: 0x2f3452,
  ground: 0x171929,
  groundDeep: 0x10111d,
  tick: 0x2b2f4a,
  pit: 0x07080e,
  line: 0xb8f23a,
  sun: 0xffc93c,
  ink: "#F4F5FB",
  stars: true,
};
const LIGHT: Theme = {
  skyTop: [0xdfe8f7, 0xeadff3],
  skyLow: [0xf3f5fb, 0xfbe1cf],
  far: 0xd3d9e8,
  mid: 0xc3cadd,
  ground: 0xffffff,
  groundDeep: 0xeef0f6,
  tick: 0xd8dce8,
  pit: 0x5a5e78,
  line: 0x437a00,
  sun: 0xff8a3d,
  ink: "#12131D",
  stars: false,
};

const C = {
  crate: 0xffc93c,
  crateEdge: 0xc8921a,
  crate2: 0xffb020,
  cone: 0xff8a3d,
  coneBase: 0xb4520f,
  hurdle: 0x2fd3e0,
  post: 0xf4f5fb,
  droneHead: 0x8b7cff,
  droneLow: 0xff6b6b,
  balloon: 0x2fd3e0,
  ghost: 0xff8a3d,
};

const mix = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, t));
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const backOut = (p: number, s = 1.7) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
/** Stable pseudo-random 0..1 for scenery item i of layer k. */
const hash = (i: number, k: number) => ((Math.imul(i * 374761393 + k * 668265263, 1274126177) >>> 0) % 10007) / 10007;

export interface RunnerPainterOptions {
  /** localStorage key of this run's best distance (endless runs); omitted for levels */
  bestKey?: string;
}

function readBest(key?: string): number {
  if (!key) return 0;
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

export function createRunnerPainter(o: RunnerPainterOptions = {}): Painter<RunnerSim> {
  let jumpAt = -1e9;
  let landAt = -1e9;
  let crashNow = -1e9;
  let pendingBurst = false;
  let parts: Particle[] = [];
  let best = -1;
  let newBest = false;

  return {
    onEvents(ev, sim, now) {
      if (ev & EV.JUMP) jumpAt = now;
      if (ev & EV.LAND) landAt = now;
      if (ev & EV.DEATH) {
        crashNow = now;
        pendingBurst = true;
      }
      if (ev & EV.RESPAWN) parts = [];
      if (ev & EV.FINISH && o.bestKey && sim.def.target === undefined) {
        if (best < 0) best = readBest(o.bestKey);
        if (sim.score() > best) {
          newBest = best > 0;
          best = sim.score();
          try {
            localStorage.setItem(o.bestKey, String(best));
          } catch {
            /* private mode */
          }
        }
      }
    },

    draw(ctx, sim, ghost) {
      const { g, w, h, dpr, now, reduced } = ctx;
      if (best < 0) best = readBest(o.bestKey);
      const light = typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
      const T = light ? LIGHT : DARK;
      const cssW = w / dpr;
      const S = dpr * Math.max(1, Math.min(1.5, cssW / 300));
      const rx = Math.max(28, cssW * 0.12) * dpr;
      const groundY = Math.round(h * (h > w ? 0.7 : 0.74));
      const dist = sim.dist / FP;
      const pace = sim.pace();

      // crash shake (not with reduced motion)
      const tc = now - crashNow;
      const shake = !reduced && tc < 260 ? Math.sin(tc * 0.09) * 4 * dpr * (1 - tc / 260) : 0;
      const sx = (xw: number) => rx + (xw - dist) * S + shake;
      const cam = reduced ? 0 : dist;

      /* ---------- sky ---------- */
      const bands = 14;
      const top = mix(T.skyTop[0], T.skyTop[1], pace);
      const low = mix(T.skyLow[0], T.skyLow[1], pace);
      for (let i = 0; i < bands; i++) {
        g.fillStyle(mix(top, low, i / (bands - 1)), 1);
        g.fillRect(0, Math.floor((groundY * i) / bands), w, Math.ceil(groundY / bands) + 1);
      }
      if (T.stars) {
        for (let i = 0; i < 28; i++) {
          const x = (((hash(i, 9) * w * 1.3 - cam * 0.03 * S) % (w * 1.3)) + w * 1.3) % (w * 1.3);
          const y = hash(i, 10) * groundY * 0.55;
          g.fillStyle(0xf4f5fb, 0.18 + 0.25 * hash(i, 11));
          g.fillCircle(x, y, (0.6 + hash(i, 12)) * dpr);
        }
      }
      // the sun (light) or a low gold moon sinks toward the horizon as the run speeds up
      const sunY = groundY * (0.3 + 0.5 * pace);
      g.fillStyle(T.sun, light ? 0.55 : 0.35);
      g.fillCircle(w * 0.62, sunY, 14 * S);

      /* ---------- far skyline (0.12) ---------- */
      const layer = (factor: number, step: number, drawOne: (x: number, i: number) => void) => {
        const off = cam * factor;
        const first = Math.floor(off / step) - 1;
        const last = first + Math.ceil(w / S / step) + 3;
        for (let i = first; i <= last; i++) drawOne((i * step - off) * S, i);
      };
      g.fillStyle(mix(low, T.far, 0.7), 1);
      layer(0.12, 34, (x, i) => {
        const bw = (20 + hash(i, 1) * 26) * S;
        const bh = (18 + hash(i, 2) * 50) * S;
        g.fillRoundedRect(x, groundY - bh, bw, bh + 2, Math.min(6 * S, bw / 3));
      });
      /* ---------- near trees (0.35) ---------- */
      g.fillStyle(T.mid, 1);
      layer(0.35, 46, (x, i) => {
        if (hash(i, 3) < 0.35) return;
        const r = (6 + hash(i, 4) * 8) * S;
        const stem = (6 + hash(i, 5) * 10) * S;
        g.fillRect(x - 1.2 * S, groundY - stem, 2.4 * S, stem);
        g.fillCircle(x, groundY - stem - r * 0.7, r);
      });

      /* ---------- ground ---------- */
      g.fillStyle(T.ground, 1);
      g.fillRect(0, groundY, w, h - groundY);
      g.fillStyle(T.groundDeep, 1);
      g.fillRect(0, groundY + 14 * S, w, h - groundY - 14 * S);
      g.fillStyle(T.tick, 1);
      const tickStep = 24;
      for (let t = Math.floor((dist - rx / S) / tickStep) - 1; t * tickStep < dist + w / S; t++) {
        g.fillRect(sx(t * tickStep), groundY + 6 * S, 6 * S, 1.5 * S);
        if (hash(t, 6) < 0.3) g.fillRect(sx(t * tickStep + 11), groundY + 10 * S, 2 * S, 1.5 * S);
      }
      // the ground's face: faint strata and pebbles that scroll with the track
      for (let r = 0; r < 5; r++) {
        const y = groundY + (30 + r * 26 + r * r * 6) * S;
        if (y > h) break;
        g.fillStyle(T.tick, 0.55 - r * 0.08);
        g.fillRect(0, y, w, 1 * dpr);
        const step = 28 + r * 10;
        for (let t = Math.floor((dist - rx / S) / step) - 1; t * step < dist + w / S; t++) {
          if (hash(t, 20 + r) < 0.45) continue;
          g.fillRoundedRect(
            sx(t * step + hash(t, 30 + r) * 12),
            y + (6 + hash(t, 40 + r) * 8) * S,
            (3 + hash(t, 50 + r) * 6) * S,
            2 * S,
            1 * S,
          );
        }
      }
      g.fillStyle(T.line, 1);
      g.fillRect(0, groundY - 1 * dpr, w, 2 * dpr);
      // distance posts every 50 m
      for (let m = Math.max(50, Math.floor((dist - rx / S) / M_PX / 50) * 50); m * M_PX < dist + w / S; m += 50) {
        const x = sx(m * M_PX);
        g.fillStyle(T.tick, 1);
        g.fillRect(x - 0.75 * dpr, groundY + 2 * dpr, 1.5 * dpr, 12 * S);
        ctx.label(`post${(m / 50) % 4}`, `${m}`, x, groundY + 26 * S, { color: light ? "#8A8EA8" : "#5A5E78", size: 11, weight: 600 });
      }
      // level finish line
      if (sim.def.target !== undefined) {
        const x = sx(sim.def.target * M_PX);
        if (x > -20 * dpr && x < w + 20 * dpr) {
          g.fillStyle(T.line, 1);
          g.fillRect(x - 1 * dpr, groundY - 44 * S, 2 * dpr, 44 * S);
          g.fillTriangle(x + 1 * dpr, groundY - 44 * S, x + 1 * dpr + 14 * S, groundY - 39 * S, x + 1 * dpr, groundY - 34 * S);
        }
      }

      /* ---------- obstacles ---------- */
      for (const ob of sim.obs) {
        const x = sx(ob.x / FP);
        const ow = (ob.w / FP) * S;
        if (x > w || x + ow < 0) continue;
        drawObstacle(g, ob, x, groundY, S, T, now, reduced);
      }

      /* ---------- ghost ---------- */
      if (ghost) {
        const gs = ghost.sim;
        if (!(gs.finished && gs.deaths)) {
          if (gs.crashT === 0) drawRunner(g, gs, sx(gs.dist / FP), groundY, S, C.ghost, 0.45, -1e9, -1e9, now, true, 0);
        } else {
          const x = sx(gs.crashAt.x / FP + BODY.w / 2);
          if (x > -40 * dpr && x < w + 40 * dpr) {
            g.fillStyle(C.ghost, 0.9);
            g.fillRect(x - 1 * dpr, groundY - 34 * S, 2 * dpr, 34 * S);
            g.fillTriangle(x + 1 * dpr, groundY - 34 * S, x + 1 * dpr + 12 * S, groundY - 30 * S, x + 1 * dpr, groundY - 26 * S);
            ctx.label("gmark", `${ghost.name} ${gs.metres()} m`, x, groundY - 38 * S, { color: "#FF8A3D", size: 12, weight: 700 });
          }
        }
      }

      /* ---------- Spuz ---------- */
      const crashed = sim.crashT > 0 || (sim.finished && sim.deaths > 0 && sim.def.target === undefined);
      const px = sx(dist);
      drawRunner(g, sim, px, groundY, S, SCENE.spuz, sim.crashT > 0 ? 0.55 : 1, jumpAt, landAt, now, reduced, crashed ? 1 : 0);
      if (pendingBurst) {
        pendingBurst = false;
        const feet = groundY - (Math.max(sim.crashAt.y, 0) / FP) * S;
        parts = burst(px + BODY.w * 0.5 * S, feet - BODY.h * 0.5 * S, now, 0.9 * dpr, [SCENE.spuz, 0xffc93c, 0xf4f5fb]);
      }
      if (parts.length) parts = drawParticles(g, parts, now, 0.9 * dpr);

      /* ---------- HUD ---------- */
      drawHud(ctx, sim, ghost, best, newBest);
    },
  };
}

function drawObstacle(g: Gfx, ob: Obstacle, x: number, groundY: number, S: number, T: Theme, now: number, reduced: boolean) {
  const ow = (ob.w / FP) * S;
  const oh = (ob.h / FP) * S;
  const bottom = groundY - (ob.y / FP) * S;
  const topY = bottom - oh;
  const crate = (cx: number, cy: number, cw: number, ch: number, col: number) => {
    g.fillStyle(col, 1);
    g.fillRoundedRect(cx, cy, cw, ch, 2 * S);
    g.lineStyle(Math.max(1, 1.2 * S), C.crateEdge, 0.9);
    g.strokeRoundedRect(cx + 1.5 * S, cy + 1.5 * S, cw - 3 * S, ch - 3 * S, 1.5 * S);
    g.lineBetween(cx + 2 * S, cy + 2 * S, cx + cw - 2 * S, cy + ch - 2 * S);
  };
  switch (ob.k) {
    case KIND.CRATE:
      crate(x, topY, ow, oh, C.crate);
      break;
    case KIND.STACK: {
      const half = oh / 2;
      crate(x, topY + half, ow, half, C.crate);
      crate(x + 1 * S, topY, ow - 2 * S, half, C.crate2);
      break;
    }
    case KIND.CONE: {
      g.fillStyle(C.coneBase, 1);
      g.fillRoundedRect(x - 1 * S, bottom - 2.5 * S, ow + 2 * S, 2.5 * S, 1 * S);
      g.fillStyle(C.cone, 1);
      g.fillTriangle(x, bottom - 2.5 * S, x + ow, bottom - 2.5 * S, x + ow / 2, topY);
      g.fillStyle(0xf4f5fb, 0.95);
      g.fillRect(x + ow * 0.28, topY + oh * 0.42, ow * 0.44, oh * 0.13);
      break;
    }
    case KIND.HURDLE: {
      g.fillStyle(C.post, 1);
      g.fillRect(x + 1 * S, topY, 2 * S, oh);
      g.fillRect(x + ow - 3 * S, topY, 2 * S, oh);
      g.fillStyle(C.hurdle, 1);
      g.fillRoundedRect(x, topY, ow, 4 * S, 1.5 * S);
      g.fillStyle(0xf4f5fb, 0.9);
      for (let k = 1; k < 4; k++) g.fillRect(x + (ow * k) / 4 - 1.5 * S, topY, 3 * S, 4 * S);
      break;
    }
    case KIND.GAP: {
      // a hole through the ground's face, darkest at the top
      g.fillStyle(mix(T.groundDeep, T.pit, 0.55), 1);
      g.fillRect(x, groundY - 1 * S, ow, 400 * S);
      g.fillStyle(T.pit, 1);
      g.fillRect(x, groundY - 1 * S, ow, 22 * S);
      g.fillStyle(T.line, 1);
      g.fillRect(x - 2 * S, groundY - 1 * S, 2 * S, 8 * S);
      g.fillRect(x + ow, groundY - 1 * S, 2 * S, 8 * S);
      break;
    }
    case KIND.DRONE_LOW:
    case KIND.DRONE_HEAD: {
      const col = ob.k === KIND.DRONE_HEAD ? C.droneHead : C.droneLow;
      // rotors: a short blur that breathes (static with reduced motion)
      const spin = reduced ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(now * 0.04 + ob.x));
      g.lineStyle(Math.max(1, 1.2 * S), 0xf4f5fb, 0.75);
      for (const cx of [x + 3 * S, x + ow - 3 * S]) {
        g.lineBetween(cx, topY + 1 * S, cx, topY - 1.5 * S);
        g.lineBetween(cx - 4 * S * spin, topY - 1.5 * S, cx + 4 * S * spin, topY - 1.5 * S);
      }
      g.fillStyle(col, 1);
      g.fillRoundedRect(x, topY + 1 * S, ow, oh - 1 * S, 3 * S);
      g.fillStyle(0xf4f5fb, 1);
      g.fillCircle(x + 4.5 * S, topY + oh * 0.55, 2.3 * S);
      g.fillStyle(SCENE.ink, 1);
      g.fillCircle(x + 3.8 * S, topY + oh * 0.55, 1.2 * S);
      break;
    }
    case KIND.BALLOON: {
      g.lineStyle(Math.max(1, 0.8 * S), T.tick === 0x2b2f4a ? 0xa2a6c2 : 0x5a5e78, 0.8);
      g.lineBetween(x + ow / 2, bottom, x + ow / 2 + 1 * S, bottom + 5 * S);
      g.fillStyle(C.balloon, 1);
      g.fillCircle(x + ow / 2, topY + ow / 2, ow / 2);
      g.fillTriangle(x + ow / 2 - 2 * S, bottom, x + ow / 2 + 2 * S, bottom, x + ow / 2, bottom - 3 * S);
      g.fillStyle(0xf4f5fb, 0.6);
      g.fillCircle(x + ow * 0.36, topY + ow * 0.32, 1.8 * S);
      break;
    }
  }
}

function drawRunner(
  g: Gfx,
  sim: RunnerSim,
  x: number,
  groundY: number,
  S: number,
  color: number,
  alpha: number,
  jumpAt: number,
  landAt: number,
  now: number,
  reduced: boolean,
  mood: number,
) {
  const feet = groundY - (sim.y / FP) * S;
  if (sim.ducking) {
    // low and wide: the hitbox shrinks to 9 px
    const size = (BODY.duckW / 1.08) * S;
    drawSpuz(g, { x: x + (BODY.w / 2) * S, feet, size, facing: 1, up: 1, scaleY: 0.7, color, alpha, mood });
    return;
  }
  let scaleY = 1;
  if (!reduced && !mood) {
    const tj = now - jumpAt;
    const tl = now - landAt;
    if (!sim.onGround && tj < 200) scaleY = 1.14 - 0.14 * easeOut(tj / 200);
    else if (!sim.onGround) scaleY = sim.vy < 0 ? 1.05 : 1;
    else if (tl < 220) scaleY = 0.8 + 0.2 * backOut(tl / 220);
    else scaleY = 1 + 0.045 * Math.sin((sim.dist / FP) * 0.35);
  }
  if (mood && sim.crashT === 0) scaleY = 0.92;
  drawSpuz(g, { x: x + (BODY.w / 2) * S, feet, size: BODY.h * S, facing: 1, up: 1, scaleY, color, alpha, mood });
}

/** Ink chips with the run's numbers: metres and best (or goal) top left, speed pips and the ghost top right. */
function drawHud(ctx: DrawCtx, sim: RunnerSim, ghost: { sim: RunnerSim; name: string } | null, best: number, newBest: boolean) {
  const { g, w, h, dpr } = ctx;
  const u = dpr;
  const pad = 12 * u;
  const m = sim.metres();
  const level = sim.def.target !== undefined;
  const sub = level ? `GOAL ${sim.def.target} m` : best > 0 ? `BEST ${best} m` : "";
  const main = `${m} m`;
  const cw = Math.max(76 * u, (Math.max(main.length * 12.5, sub.length * 7) + 24) * u);
  const ch = (sub ? 50 : 38) * u;
  g.fillStyle(SCENE.ink, 0.88);
  g.fillRoundedRect(pad, pad, cw, ch, 12 * u);
  ctx.label("hud-m", main, pad + cw / 2, pad + 30 * u, { color: "#F4F5FB", size: 21, weight: 700 });
  if (sub) ctx.label("hud-sub", sub, pad + cw / 2, pad + 45 * u, { color: "#A2A6C2", size: 11, weight: 700 });

  // speed pips: five, lime as the run climbs to its top speed
  const pips = 5;
  const on = Math.max(1, Math.ceil(sim.pace() * pips - 1e-6));
  const pw = 6 * u,
    ph = 14 * u,
    gap = 3 * u;
  const sw = 50 * u + pips * (pw + gap);
  const sxp = w - pad - sw;
  g.fillStyle(SCENE.ink, 0.88);
  g.fillRoundedRect(sxp, pad, sw, 38 * u, 12 * u);
  ctx.label("hud-speed", "SPEED", sxp + 28 * u, pad + 25 * u, { color: "#A2A6C2", size: 11, weight: 700 });
  for (let i = 0; i < pips; i++) {
    g.fillStyle(i < on ? 0xb8f23a : 0x2b2f4a, 1);
    g.fillRoundedRect(sxp + 50 * u + i * (pw + gap), pad + 12 * u, pw, ph, 2 * u);
  }

  if (ghost) {
    const gs = ghost.sim;
    const gone = gs.finished && gs.deaths > 0;
    const passed = gone && sim.dist > gs.crashAt.x;
    const text = passed ? `Passed ${ghost.name}` : gone ? `${ghost.name}: ${gs.metres()} m` : `vs ${ghost.name}`;
    const gw = Math.min(w - 2 * pad, (text.length * 7.6 + 26) * u);
    g.fillStyle(SCENE.ink, 0.88);
    g.fillRoundedRect(w - pad - gw, pad + 44 * u, gw, 30 * u, 10 * u);
    g.fillStyle(passed ? 0xb8f23a : 0xff8a3d, 1);
    g.fillCircle(w - pad - gw + 12 * u, pad + 59 * u, 4 * u);
    ctx.label("hud-ghost", text, w - pad - gw / 2 + 6 * u, pad + 66 * u, { color: "#F4F5FB", size: 13, weight: 600 });
  }

  // run over: one centred card
  if (sim.finished) {
    const title = level ? "Level cleared" : sim.deaths ? (newBest ? "New best" : "Run over") : "Time up";
    const cy = h * 0.36;
    const bw = 190 * u;
    g.fillStyle(SCENE.ink, 0.9);
    g.fillRoundedRect(w / 2 - bw / 2, cy - 34 * u, bw, 70 * u, 16 * u);
    ctx.label("hud-over", title, w / 2, cy - 8 * u, { color: newBest || level ? "#B8F23A" : "#F4F5FB", size: 15, weight: 700 });
    ctx.label("hud-over-m", `${m} m`, w / 2, cy + 26 * u, { color: "#F4F5FB", size: 26, weight: 800 });
  }
}
