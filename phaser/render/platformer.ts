/**
 * Painter for the tile games (Gotcha, Dash, Flipside, Ghosted, Gauntlet, Grapple, Slip).
 * Reads the sim, never writes it. Death: squish to scaleY .5, pixel burst, then a 300 ms fade in on
 * respawn; reduced motion skips the burst and the fade. Telegraphs pulse at 1 Hz (well under 2 Hz).
 */
import { EV } from "../sim/core";
import { FP, TILE, TILE_PX } from "../sim/fixed";
import { Cell } from "../sim/level";
import { BODY_H, BODY_W, EXIT_H, EXIT_W, type PlatformerCourse } from "../sim/platformer";
import { burst, drawSpuz, type Particle } from "./spuz";
import { SCENE, type Painter } from "./types";

/** Rows of world shown on screen. */
export const VIEW_ROWS = 7;

export interface PainterOptions {
  /** Dash look: one continuous ground slab, raised blocks in the ledge colour */
  slab?: boolean;
  /** rows of world on screen (default 7) */
  viewRows?: number;
}

export function createPlatformerPainter(opts: PainterOptions = {}): Painter<PlatformerCourse> {
  let parts: Particle[] = [];
  let deathAt = -1e9;
  let respawnAt = -1e9;
  let lastJump = -1e9;
  let lastLand = -1e9;
  let camX = NaN;
  let camY = NaN;
  let lvlIdx = -1;

  return {
    onEvents(ev, sim, now) {
      if (ev & EV.DEATH) {
        deathAt = now;
        const d = sim.world.deathAt;
        parts = parts.concat(burst(d.x / FP, d.y / FP, now, 1, [SCENE.spuz, 0xff3b3b, SCENE.white]));
      }
      if (ev & EV.RESPAWN) {
        respawnAt = now;
        camX = NaN;
      }
      if (ev & (EV.JUMP | EV.FLIP)) lastJump = now;
      if (ev & EV.LAND) lastLand = now;
    },

    draw(ctx, sim, ghost) {
      const { g, w, h, now, reduced, palette } = ctx;
      const world = sim.world;
      const lvl = world.lvl;
      const rows = opts.viewRows ?? VIEW_ROWS;
      const s = h / (rows * TILE_PX); // device px per world px
      const viewW = w / s,
        viewH = rows * TILE_PX;
      const lvlW = lvl.w * TILE_PX,
        lvlH = lvl.h * TILE_PX;
      const b = world.body;
      const px = (b.x + BODY_W / 2) / FP,
        py = (b.y + BODY_H / 2) / FP;
      const tx = lvlW <= viewW ? (lvlW - viewW) / 2 : Math.max(0, Math.min(lvlW - viewW, px - viewW * 0.4));
      const ty = lvlH <= viewH ? lvlH - viewH : Math.max(0, Math.min(lvlH - viewH, py - viewH / 2));
      if (sim.idx !== lvlIdx || Number.isNaN(camX) || reduced) {
        camX = tx;
        camY = ty;
        lvlIdx = sim.idx;
      } else {
        camX += (tx - camX) * 0.18;
        camY += (ty - camY) * 0.18;
      }
      const X = (wx: number) => (wx - camX) * s;
      const Y = (wy: number) => (wy - camY) * s;
      const T = TILE_PX * s;
      const pulse = 0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * 2); // 1 Hz

      // Background and dot grid (20 css px), slow parallax.
      ctx.bg.fillStyle(SCENE.bg, 1);
      ctx.bg.fillRect(0, 0, w, h);
      ctx.bg.fillStyle(SCENE.dot, 1);
      const step = 20 * ctx.dpr;
      const off = (-(camX * s) * 0.3) % step;
      for (let y = step / 2; y < h; y += step) for (let x = off; x < w; x += step) ctx.bg.fillCircle(x, y, 1.5 * ctx.dpr);

      const x0 = Math.max(0, Math.floor(camX / TILE_PX) - 1),
        x1 = Math.min(lvl.w - 1, Math.ceil((camX + viewW) / TILE_PX) + 1);
      const y0 = Math.max(0, Math.floor(camY / TILE_PX) - 1),
        y1 = Math.min(lvl.h - 1, Math.ceil((camY + viewH) / TILE_PX) + 1);
      const gap = Math.max(1, s);
      const solidAt = (cx: number, cy: number) => cy >= 0 && cy < lvl.h && cx >= 0 && cx < lvl.w && world.solidCell(cx, cy);

      const block = (cx: number, cy: number, color: number, alpha = 1, dy = 0) => {
        const top = !solidAt(cx, cy - 1);
        g.fillStyle(color, alpha);
        g.fillRoundedRect(
          X(cx * TILE_PX) + gap / 2,
          Y(cy * TILE_PX) + dy + (top ? 0 : 0),
          T - gap,
          T,
          top ? { tl: 4 * s, tr: 4 * s, bl: 0, br: 0 } : 0,
        );
      };
      const spike = (cx: number, cy: number, dir: number, color: number, alpha: number, k = 1, outline = false) => {
        const bx = X(cx * TILE_PX),
          by = Y(cy * TILE_PX);
        const half = 7 * s * k,
          hh = 12 * s * k;
        const mid = bx + T / 2;
        if (outline) g.lineStyle(Math.max(1, s), color, alpha);
        else g.fillStyle(color, alpha);
        const draw = outline ? g.strokeTriangle.bind(g) : g.fillTriangle.bind(g);
        if (dir > 0) draw(mid - half, by + T, mid + half, by + T, mid, by + T - hh);
        else draw(mid - half, by, mid + half, by, mid, by + hh);
      };

      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const i = cy * lvl.w + cx;
          const c = lvl.cells[i];
          if (c === Cell.Solid && opts.slab) {
            g.fillStyle(cy < lvl.h - 2 ? SCENE.ledge : SCENE.ground, 1);
            const top = !solidAt(cx, cy - 1);
            g.fillRoundedRect(
              X(cx * TILE_PX) - 0.5,
              Y(cy * TILE_PX),
              T + 1,
              T + (cy < lvl.h - 1 ? 1 : 0),
              top && cy < lvl.h - 2 ? { tl: 8 * s * 0.5, tr: 8 * s * 0.5, bl: 0, br: 0 } : 0,
            );
          } else if (c === Cell.Solid) block(cx, cy, solidAt(cx, cy - 1) ? SCENE.groundDeep : SCENE.ground);
          else if (c === Cell.Ledge) {
            g.fillStyle(SCENE.ledge, 1);
            g.fillRoundedRect(X(cx * TILE_PX) + gap / 2, Y(cy * TILE_PX) + gap / 2, T - gap, T - gap, 6 * s);
          } else if (c === Cell.SpikeUp || c === Cell.SpikeDown) spike(cx, cy, c === Cell.SpikeUp ? 1 : -1, palette.rage, 1);
          else if (c === Cell.Trap) {
            const k = lvl.trapOf[i];
            const tr = lvl.traps[k];
            const on = world.active(k);
            const since = on ? world.t - (world.fired[k] + tr.delay) : 0;
            if (tr.kind === "drop") {
              if (!on) {
                block(cx, cy, SCENE.ground);
                const warn = world.telegraph || world.fired[k] >= 0;
                if (warn) {
                  // cracks plus a pulsing outline: this floor lies
                  const bx = X(cx * TILE_PX),
                    by = Y(cy * TILE_PX);
                  g.lineStyle(Math.max(1, s), SCENE.bg, 1);
                  g.lineBetween(bx + T * 0.2, by + T * 0.15, bx + T * 0.5, by + T * 0.55);
                  g.lineBetween(bx + T * 0.5, by + T * 0.55, bx + T * 0.8, by + T * 0.35);
                  g.lineStyle(Math.max(1, s), palette.rage, 0.35 + 0.35 * pulse);
                  g.strokeRoundedRect(bx + gap, by + gap, T - 2 * gap, T - 2 * gap, 3 * s);
                }
              } else if (since < 40) {
                const fall = reduced ? T * 2 : 0.25 * since * since * s;
                block(cx, cy, SCENE.ground, Math.max(0, 1 - since / 40), fall);
              }
            } else if (tr.kind === "spikes") {
              const dir = tr.dirs[tr.cells.indexOf(i)];
              if (on) spike(cx, cy, dir, palette.rage, 1, reduced ? 1 : Math.min(1, (since + 1) / 5));
              else if (world.telegraph) spike(cx, cy, dir, palette.rage, 0.3 + 0.3 * pulse, 1, true);
            } else if (tr.kind === "block") {
              if (on) {
                g.fillStyle(SCENE.ledge, 1);
                g.fillRoundedRect(X(cx * TILE_PX) + gap / 2, Y(cy * TILE_PX) + gap / 2, T - gap, T - gap, 4 * s);
              } else if (world.telegraph) {
                g.lineStyle(Math.max(1, s), palette.rage, 0.3 + 0.3 * pulse);
                g.strokeRoundedRect(X(cx * TILE_PX) + gap, Y(cy * TILE_PX) + gap, T - 2 * gap, T - 2 * gap, 4 * s);
              }
            }
          }
        }
      }

      // Moving platforms
      for (const p of lvl.platforms) {
        const r = world.platformRect(p);
        g.fillStyle(SCENE.ledge, 1);
        g.fillRoundedRect(X(r.x / FP), Y(r.y / FP), (r.w / FP) * s, (r.h / FP) * s, 4 * s);
      }

      // Hooks and the rope
      for (const hk of lvl.hooks) {
        const hx = X(hk.x * TILE_PX + TILE_PX / 2),
          hy = Y(hk.y * TILE_PX + TILE_PX / 2);
        g.lineStyle(2 * s * 0.6, palette.gold, 1);
        g.strokeCircle(hx, hy, 4 * s);
        g.fillStyle(palette.gold, 1);
        g.fillCircle(hx, hy, 1.5 * s);
      }
      if (b.hook >= 0 && !world.dead) {
        const hk = lvl.hooks[b.hook];
        g.lineStyle(Math.max(1.5, 1.2 * s), SCENE.white, 0.85);
        g.lineBetween(X(hk.x * TILE_PX + TILE_PX / 2), Y(hk.y * TILE_PX + TILE_PX / 2), X(px), Y(py));
      }

      // Exit door, and where it will run once the player knows
      const ex = world.exitPos();
      const exX = X(ex.x / FP),
        exY = Y(ex.y / FP),
        dw = (EXIT_W / FP) * s,
        dh = (EXIT_H / FP) * s;
      if (world.telegraph) {
        lvl.traps.forEach((tr, k) => {
          if (tr.kind !== "exit" || world.fired[k] >= 0) return;
          const tx2 = X(tr.to![0] * TILE_PX + (TILE_PX - EXIT_W / FP) / 2),
            ty2 = Y((tr.to![1] + 1) * TILE_PX - EXIT_H / FP);
          g.lineStyle(Math.max(1, s), palette.gold, 0.35 + 0.3 * pulse);
          g.strokeRoundedRect(tx2, ty2, dw, dh, 4 * s);
          const n = 8;
          for (let j = 1; j < n; j++) g.fillCircle(exX + dw / 2 + ((tx2 - exX) * j) / n, exY + dh / 2 + ((ty2 - exY) * j) / n, 1.2 * s);
        });
      }
      const running = world.exitRunning();
      const hop = running && !reduced ? -Math.abs(Math.sin(now / 60)) * 3 * s : 0;
      g.fillStyle(SCENE.spuz, 1);
      g.fillRoundedRect(exX, exY + hop, dw, dh, { tl: 4 * s, tr: 4 * s, bl: 0, br: 0 });
      g.lineStyle(Math.max(1.5, 1.6 * s), SCENE.ink, 1);
      g.strokeRoundedRect(exX + 0.8 * s, exY + hop + 0.8 * s, dw - 1.6 * s, dh - 0.8 * s, 3 * s);
      g.fillStyle(SCENE.ink, 1);
      g.fillRect(exX + dw * 0.32, exY + hop + dh * 0.35, dw * 0.36, dh * 0.45);
      g.fillStyle(SCENE.spuz, 1);
      g.fillCircle(exX + dw * 0.58, exY + hop + dh * 0.6, 0.9 * s);
      if (world.exitRan()) ctx.label("ran", "the exit ran away", exX + dw / 2, exY - 3 * s, { color: "#FFC93C", size: 13, weight: 600 });

      // Ghost: translucent replay with a name tag, never collides
      if (ghost && !ghost.sim.finished && ghost.sim.idx === sim.idx && !ghost.sim.world.dead) {
        const gb = ghost.sim.world.body;
        const gx = X((gb.x + BODY_W / 2) / FP),
          gf = Y((gb.y + (gb.g > 0 ? BODY_H : 0)) / FP);
        drawSpuz(g, { x: gx, feet: gf, size: 14 * s, facing: gb.facing, up: gb.g, scaleY: 1, color: SCENE.ghost, alpha: 0.38, mood: 0 });
        ctx.label("ghost", ghost.name, gx, gf - (gb.g > 0 ? 20 : -6) * s, {
          color: "#0E0F1A",
          bg: "#F4F5FB",
          size: 12,
          weight: 700,
          alpha: 0.85,
        });
      }

      // Spuz
      const feet = Y((b.y + (b.g > 0 ? BODY_H : 0)) / FP);
      const cxp = X(px);
      if (world.dead) {
        const t = now - deathAt;
        if (!reduced && t < 160) {
          const k = Math.min(1, t / 90);
          drawSpuz(g, {
            x: cxp,
            feet,
            size: 14 * s,
            facing: b.facing,
            up: b.g,
            scaleY: 1 - 0.5 * k,
            color: SCENE.spuz,
            alpha: 1 - t / 200,
            mood: 1,
          });
        }
      } else {
        const fade = reduced ? 1 : Math.min(1, (now - respawnAt) / 300);
        const sinceJump = now - lastJump,
          sinceLand = now - lastLand;
        let scaleY = 1;
        if (!reduced && sinceJump < 120) scaleY = 1.12;
        if (!reduced && sinceLand < 100) scaleY = 0.86;
        const mood = b.grounded ? 0 : 1;
        drawSpuz(g, { x: cxp, feet, size: 14 * s, facing: b.facing, up: b.g, scaleY, color: SCENE.spuz, alpha: fade, mood });
      }
      // particles live in world px; draw them through the camera
      parts = parts.filter((p) => now - p.born < 500);
      if (!reduced) {
        for (const p of parts) {
          const t = (now - p.born) / 1000;
          const k = t * 60;
          const wx = p.x + p.vx * k,
            wy = p.y + p.vy * k + 0.5 * 0.35 * k * k;
          g.fillStyle(p.color, 1 - t / 0.5);
          g.fillRect(X(wx) - p.size * s * 0.5, Y(wy) - p.size * s * 0.5, p.size * s, p.size * s);
        }
      }
    },
  };
}

/** World px per tile (re-exported for HUD maths). */
export const TILE_WORLD = TILE / FP;
