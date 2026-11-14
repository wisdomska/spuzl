/**
 * Painter for the tile games (Gotcha, Dash, Flipside, Ghosted, Gauntlet, Grapple, Slip).
 * Reads the sim, never writes it. Death: squish to scaleY .5, pixel burst, then a 300 ms fade in on
 * respawn; reduced motion skips the burst and the fade. Telegraphs pulse at 1 Hz (well under 2 Hz).
 * With `fit` (Gotcha) the camera frames a whole room at a whole number of device px per tile, under the HUD,
 * and the troll traps draw their tells: a dotted path to where a mover or saw goes, outlines for fake ground.
 */
import { EV } from "../sim/core";
import { FP, TILE, TILE_PX } from "../sim/fixed";
import { Cell } from "../sim/level";
import { BODY_H, BODY_W, EXIT_H, EXIT_W, SAW_R, type PlatformerCourse } from "../sim/platformer";
import { burst, drawSpuz, type Particle } from "./spuz";
import { SCENE, type Gfx, type Painter } from "./types";

/** Rows of world shown on screen. */
export const VIEW_ROWS = 7;

/** css px kept clear above a fitted room for the HUD chips (12 px inset plus a 40 px chip, plus air). */
export const FIT_TOP = 58;
/** css px kept clear at the other edges of a fitted room. */
export const FIT_EDGE = 6;

export interface PainterOptions {
  /** Dash look: one continuous ground slab, raised blocks in the ledge colour */
  slab?: boolean;
  /** rows of world on screen (default 7) */
  viewRows?: number;
  /**
   * Whole-room view (Gotcha): the scale shows a `cols` x `rows` tile room in full, at a whole number of device px
   * per tile, centred under the HUD. A bigger level scrolls with the runner at that same scale.
   */
  fit?: { cols: number; rows: number };
}

/** Device px per tile for a fitted view of `cols` x `rows` tiles on a `w` x `h` device px canvas. */
export function fitTile(w: number, h: number, dpr: number, cols: number, rows: number): number {
  const availW = w - 2 * FIT_EDGE * dpr,
    availH = h - (FIT_TOP + FIT_EDGE) * dpr;
  return Math.max(4, Math.floor(Math.min(availW / cols, availH / rows)));
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

  // R4-21: the frame's drawing state and helpers live here, made once with the painter, so a frame makes no
  // closures (and no radius object) for the garbage collector. `draw` sets the state at its start.
  let g: Gfx = null!;
  let world: PlatformerCourse["world"] = null!;
  let s = 1;
  let T = 0;
  let gap = 1;
  /** One rounded-top radius, updated each frame (Phaser reads it at once). */
  const topR = { tl: 0, tr: 0, bl: 0, br: 0 };
  const X = (wx: number) => (wx - camX) * s;
  const Y = (wy: number) => (wy - camY) * s;
  const solidAt = (cx: number, cy: number) => {
    const lvl = world.lvl;
    // a fitted room's top row is its ceiling: no rounded tops along the top edge
    if (cy < 0) return !!opts.fit && cx >= 0 && cx < lvl.w;
    if (cy >= lvl.h || cx < 0 || cx >= lvl.w) return false;
    if (world.solidCell(cx, cy)) return true;
    // fake ground and a resting mover look solid to their neighbours too (a rounded edge would give the lie away)
    const k = lvl.trapOf[cy * lvl.w + cx];
    if (k < 0) return false;
    const kind = lvl.traps[k].kind;
    return kind === "fake" || (kind === "move" && world.fired[k] < 0);
  };
  const block = (cx: number, cy: number, color: number, alpha = 1, dy = 0) => {
    const top = !solidAt(cx, cy - 1);
    g.fillStyle(color, alpha);
    g.fillRoundedRect(X(cx * TILE_PX) + gap / 2, Y(cy * TILE_PX) + dy, T - gap, T, top ? topR : 0);
  };
  /** A spike in tile (cx, cy) pointing `dir` (1 up, -1 down, 2 right, -2 left), shifted (ox, oy) device px. */
  const spike = (cx: number, cy: number, dir: number, color: number, alpha: number, k = 1, outline = false, ox = 0, oy = 0) => {
    const bx = X(cx * TILE_PX) + ox,
      by = Y(cy * TILE_PX) + oy;
    const half = 7 * s * k,
      hh = 12 * s * k;
    let x0, y0, x1, y1, x2, y2;
    if (dir === 1 || dir === -1) {
      const mid = bx + T / 2;
      const base = dir > 0 ? by + T : by;
      const tip = dir > 0 ? by + T - hh : by + hh;
      [x0, y0, x1, y1, x2, y2] = [mid - half, base, mid + half, base, mid, tip];
    } else {
      const mid = by + T / 2;
      const base = dir > 0 ? bx : bx + T;
      const tip = dir > 0 ? bx + hh : bx + T - hh;
      [x0, y0, x1, y1, x2, y2] = [base, mid - half, base, mid + half, tip, mid];
    }
    if (outline) {
      g.lineStyle(Math.max(1, s), color, alpha);
      g.strokeTriangle(x0, y0, x1, y1, x2, y2);
    } else {
      g.fillStyle(color, alpha);
      g.fillTriangle(x0, y0, x1, y1, x2, y2);
    }
  };
  /** Dots from (ax, ay) to (bx, by), device px: "this is where it goes". */
  const trail = (ax: number, ay: number, bx: number, by: number, color: number, alpha: number) => {
    const n = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / (6 * s)));
    g.fillStyle(color, alpha);
    for (let j = 1; j < n; j++) g.fillCircle(ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n, 1.2 * s);
  };
  /** A door (the exit's shape) at device px; `bite` gives it teeth. */
  const door = (dx: number, dy: number, dw: number, dh: number, color: number, bite: number) => {
    g.fillStyle(color, 1);
    g.fillRoundedRect(dx, dy, dw, dh, topR);
    g.lineStyle(Math.max(1.5, 1.6 * s), SCENE.ink, 1);
    g.strokeRoundedRect(dx + 0.8 * s, dy + 0.8 * s, dw - 1.6 * s, dh - 0.8 * s, 3 * s);
    g.fillStyle(SCENE.ink, 1);
    g.fillRect(dx + dw * 0.32, dy + dh * 0.35, dw * 0.36, dh * 0.45);
    if (bite > 0) {
      // the doorway is a mouth: teeth close in from the top and bottom
      const mx = dx + dw * 0.32,
        mw = dw * 0.36,
        top = dy + dh * 0.35,
        bot = dy + dh * 0.8,
        th = dh * 0.2 * bite;
      g.fillStyle(SCENE.white, 1);
      for (let j = 0; j < 3; j++) {
        const x = mx + (mw * j) / 3;
        g.fillTriangle(x, top, x + mw / 3, top, x + mw / 6, top + th);
        g.fillTriangle(x, bot, x + mw / 3, bot, x + mw / 6, bot - th);
      }
    } else {
      g.fillStyle(color, 1);
      g.fillCircle(dx + dw * 0.58, dy + dh * 0.6, 0.9 * s);
    }
  };

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
      const { w, h, now, reduced, palette } = ctx;
      g = ctx.g;
      world = sim.world;
      const lvl = world.lvl;
      const rows = opts.viewRows ?? VIEW_ROWS;
      const fit = opts.fit;
      s = fit ? fitTile(w, h, ctx.dpr, fit.cols, fit.rows) / TILE_PX : h / (rows * TILE_PX); // device px per world px
      const viewW = w / s,
        viewH = fit ? h / s : rows * TILE_PX;
      const lvlW = lvl.w * TILE_PX,
        lvlH = lvl.h * TILE_PX;
      const b = world.body;
      const px = (b.x + BODY_W / 2) / FP,
        py = (b.y + BODY_H / 2) / FP;
      let tx: number, ty: number;
      if (fit) {
        // whole room in view: centred in the space under the HUD; a longer room follows the runner
        const top = (FIT_TOP * ctx.dpr) / s,
          edge = (FIT_EDGE * ctx.dpr) / s;
        tx = lvlW <= viewW - 2 * edge ? (lvlW - viewW) / 2 : Math.max(-edge, Math.min(lvlW - viewW + edge, px - viewW * 0.4));
        ty =
          lvlH <= viewH - top - edge
            ? lvlH / 2 - (top + (viewH - top - edge) / 2)
            : Math.max(-top, Math.min(lvlH - viewH + edge, py - (top + viewH) / 2));
      } else {
        tx = lvlW <= viewW ? (lvlW - viewW) / 2 : Math.max(0, Math.min(lvlW - viewW, px - viewW * 0.4));
        ty = lvlH <= viewH ? lvlH - viewH : Math.max(0, Math.min(lvlH - viewH, py - viewH / 2));
      }
      if (sim.idx !== lvlIdx || Number.isNaN(camX) || reduced || (fit && lvlW <= viewW && lvlH <= viewH)) {
        camX = tx;
        camY = ty;
        lvlIdx = sim.idx;
      } else {
        camX += (tx - camX) * 0.18;
        camY += (ty - camY) * 0.18;
      }
      if (fit) {
        // tiles land on whole device pixels: crisp edges at any zoom
        camX = Math.round(camX * s) / s;
        camY = Math.round(camY * s) / s;
      }
      T = TILE_PX * s;
      gap = Math.max(1, s);
      topR.tl = topR.tr = 4 * s;
      const pulse = 0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * 2); // 1 Hz

      // Background and dot grid (20 css px), slow parallax: one pre-drawn texture, not ~270 circles (R4-21).
      ctx.backdrop(-(camX * s) * 0.3, 0);

      const x0 = Math.max(0, Math.floor(camX / TILE_PX) - 1),
        x1 = Math.min(lvl.w - 1, Math.ceil((camX + viewW) / TILE_PX) + 1);
      const y0 = Math.max(0, Math.floor(camY / TILE_PX) - 1),
        y1 = Math.min(lvl.h - 1, Math.ceil((camY + viewH) / TILE_PX) + 1);

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
              top && cy < lvl.h - 2 ? topR : 0,
            );
          } else if (c === Cell.Solid) block(cx, cy, solidAt(cx, cy - 1) ? SCENE.groundDeep : SCENE.ground);
          else if (c === Cell.Ledge) {
            g.fillStyle(SCENE.ledge, 1);
            g.fillRoundedRect(X(cx * TILE_PX) + gap / 2, Y(cy * TILE_PX) + gap / 2, T - gap, T - gap, 6 * s);
          } else if (c === Cell.SpikeUp || c === Cell.SpikeDown) spike(cx, cy, c === Cell.SpikeUp ? 1 : -1, palette.rage, 1);
          else if (c === Cell.SpikeRight || c === Cell.SpikeLeft) spike(cx, cy, c === Cell.SpikeRight ? 2 : -2, palette.rage, 1);
          else if (c === Cell.Trap) {
            const k = lvl.trapOf[i];
            const tr = lvl.traps[k];
            const on = world.active(k);
            const since = on ? world.t - (world.fired[k] + tr.delay) : 0;
            if (tr.kind === "drop") {
              if (!on) {
                block(cx, cy, solidAt(cx, cy - 1) ? SCENE.groundDeep : SCENE.ground);
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
            } else if (tr.kind === "fake") {
              // paint, not ground: once you know, it goes see-through with a pulsing outline
              block(cx, cy, solidAt(cx, cy - 1) ? SCENE.groundDeep : SCENE.ground, world.telegraph ? 0.4 : 1);
              if (world.telegraph) {
                g.lineStyle(Math.max(1, s), palette.rage, 0.35 + 0.35 * pulse);
                g.strokeRoundedRect(X(cx * TILE_PX) + gap, Y(cy * TILE_PX) + gap, T - 2 * gap, T - 2 * gap, 3 * s);
              }
            }
          }
        }
      }

      // Troll traps that move (drawn off the grid) and zones that bend the rules
      const tro = world.trolls;
      for (const k of tro.move) {
        const tr = lvl.traps[k];
        const o = world.groupOffset(k);
        const ox = (o.x / FP) * s,
          oy = (o.y / FP) * s;
        const resting = world.fired[k] < 0;
        for (const i of tr.cells) {
          const cx = i % lvl.w,
            cy = Math.floor(i / lvl.w);
          // covered by its own group (it travels with it) or, at rest, by the ground it pretends to be part of
          const covered = tr.cells.includes(i - lvl.w) || (resting && solidAt(cx, cy - 1));
          g.fillStyle(covered ? SCENE.groundDeep : SCENE.ground, 1);
          g.fillRoundedRect(X(cx * TILE_PX) + gap / 2 + ox, Y(cy * TILE_PX) + oy, T - gap, T, covered ? 0 : topR);
        }
        if (world.telegraph && resting) {
          const [bx, by] = tr.by!;
          g.lineStyle(Math.max(1, s), palette.rage, 0.3 + 0.3 * pulse);
          for (const i of tr.cells) {
            const cx = i % lvl.w,
              cy = Math.floor(i / lvl.w);
            g.strokeRoundedRect(X((cx + bx) * TILE_PX) + gap, Y((cy + by) * TILE_PX) + gap, T - 2 * gap, T - 2 * gap, 3 * s);
          }
          const c0 = tr.cells[0],
            c1 = tr.cells[tr.cells.length - 1];
          const mx = X((((c0 % lvl.w) + (c1 % lvl.w) + 1) / 2) * TILE_PX),
            my = Y(((Math.floor(c0 / lvl.w) + Math.floor(c1 / lvl.w) + 1) / 2) * TILE_PX);
          trail(mx, my, mx + bx * T, my + by * T, palette.rage, 0.45 + 0.35 * pulse);
        }
      }
      for (const k of tro.slide) {
        const tr = lvl.traps[k];
        const o = world.groupOffset(k);
        const ox = (o.x / FP) * s,
          oy = (o.y / FP) * s;
        tr.cells.forEach((i, j) => spike(i % lvl.w, Math.floor(i / lvl.w), tr.dirs[j], palette.rage, 1, 1, false, ox, oy));
        if (world.telegraph && world.fired[k] < 0) {
          const [bx, by] = tr.by!;
          tr.cells.forEach((i, j) =>
            spike((i % lvl.w) + bx, Math.floor(i / lvl.w) + by, tr.dirs[j], palette.rage, 0.3 + 0.3 * pulse, 1, true),
          );
          const i = tr.cells[0];
          const ax = X(((i % lvl.w) + 0.5) * TILE_PX),
            ay = Y((Math.floor(i / lvl.w) + 0.5) * TILE_PX);
          trail(ax, ay, ax + bx * T, ay + by * T, palette.rage, 0.45 + 0.35 * pulse);
        }
      }
      for (const k of tro.saw) {
        const tr = lvl.traps[k];
        const r = (tr.r ?? SAW_R) * s;
        const ax = X((tr.from![0] + 0.5) * TILE_PX),
          ay = Y((tr.from![1] + 0.5) * TILE_PX);
        if (world.telegraph) {
          trail(ax, ay, X((tr.to![0] + 0.5) * TILE_PX), Y((tr.to![1] + 0.5) * TILE_PX), palette.rage, 0.35 + 0.3 * pulse);
          if (!world.active(k)) {
            g.lineStyle(Math.max(1, s), palette.rage, 0.3 + 0.3 * pulse);
            g.strokeCircle(ax, ay, r);
          }
        }
        const c = world.sawPos(k);
        if (!c) continue;
        const sx = X(c.x / FP),
          sy = Y(c.y / FP);
        const since = world.t - world.fired[k] - tr.delay;
        const grow = reduced ? 1 : Math.min(1, (since + 1) / 6); // pops out quickly, eased by the frame count
        const rr = r * grow;
        const spin = reduced ? 0 : (now / 1000) * Math.PI * 4;
        g.fillStyle(palette.rage, 1);
        for (let j = 0; j < 8; j++) {
          const a = spin + (j * Math.PI) / 4;
          const tx2 = sx + Math.cos(a) * rr * 1.25,
            ty2 = sy + Math.sin(a) * rr * 1.25;
          const l = a - 0.35,
            q = a + 0.35;
          g.fillTriangle(
            sx + Math.cos(l) * rr * 0.8,
            sy + Math.sin(l) * rr * 0.8,
            sx + Math.cos(q) * rr * 0.8,
            sy + Math.sin(q) * rr * 0.8,
            tx2,
            ty2,
          );
        }
        g.fillCircle(sx, sy, rr * 0.85);
        g.fillStyle(SCENE.bg, 1);
        g.fillCircle(sx, sy, rr * 0.25);
      }
      for (const k of [...tro.flip, ...tro.reverse]) {
        if (!world.telegraph) continue;
        const tr = lvl.traps[k];
        const zones = tr.zone
          ? [tr.zone]
          : lvl.triggers.filter((t2) => t2.fire.includes(k)).map((t2) => [t2.x / TILE, t2.y / TILE, t2.w / TILE, t2.h / TILE]);
        for (const [zx, zy, zw, zh] of zones) {
          const x0z = X(zx * TILE_PX),
            y0z = Y(zy * TILE_PX),
            wz = zw * T,
            hz = zh * T;
          const color = tr.kind === "flip" ? SCENE.cyan : palette.gold;
          g.fillStyle(color, 0.07 + 0.05 * pulse);
          g.fillRect(x0z, y0z, wz, hz);
          g.lineStyle(Math.max(1, s), color, 0.35 + 0.3 * pulse);
          g.strokeRect(x0z, y0z, wz, hz);
          // flip: little up arrows; reverse: a pair of opposing chevrons
          const n = Math.max(1, Math.floor(zw / 2));
          g.fillStyle(color, 0.45 + 0.3 * pulse);
          for (let j = 0; j < n; j++) {
            const cxz = x0z + ((j + 0.5) * wz) / n,
              cyz = y0z + hz / 2;
            if (tr.kind === "flip") {
              g.fillTriangle(cxz - 3 * s, cyz - 1 * s, cxz + 3 * s, cyz - 1 * s, cxz, cyz - 5 * s);
              g.fillTriangle(cxz - 3 * s, cyz + 1 * s, cxz + 3 * s, cyz + 1 * s, cxz, cyz + 5 * s);
            } else {
              g.fillTriangle(cxz - 1 * s, cyz - 3 * s, cxz - 1 * s, cyz + 3 * s, cxz - 5 * s, cyz);
              g.fillTriangle(cxz + 1 * s, cyz - 3 * s, cxz + 1 * s, cyz + 3 * s, cxz + 5 * s, cyz);
            }
          }
        }
      }

      // Signs: the room's own jokes, painted on the wall
      if (lvl.def.signs)
        for (const [j, sg] of lvl.def.signs.entries())
          ctx.label(`sign${j}`, sg.text, X((sg.at[0] + 0.5) * TILE_PX), Y((sg.at[1] + 1) * TILE_PX) - 2 * s, {
            color: "#A2A6C2",
            size: Math.max(10, Math.min(14, Math.round((T / ctx.dpr) * 0.75))),
            weight: 600,
          });

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
        // each run starts where the last one ends, so a door that runs twice draws one path, leg by leg
        let fromX = exX,
          fromY = exY;
        for (let k = 0; k < lvl.traps.length; k++) {
          const tr = lvl.traps[k];
          if (tr.kind !== "exit" || world.fired[k] >= 0) continue;
          const tx2 = X(tr.to![0] * TILE_PX + (TILE_PX - EXIT_W / FP) / 2),
            ty2 = Y((tr.to![1] + 1) * TILE_PX - EXIT_H / FP);
          g.lineStyle(Math.max(1, s), palette.gold, 0.35 + 0.3 * pulse);
          g.strokeRoundedRect(tx2, ty2, dw, dh, 4 * s);
          g.fillStyle(palette.gold, 0.5 + 0.3 * pulse);
          const n = 8;
          for (let j = 1; j < n; j++)
            g.fillCircle(fromX + dw / 2 + ((tx2 - fromX) * j) / n, fromY + dh / 2 + ((ty2 - fromY) * j) / n, 1.2 * s);
          fromX = tx2;
          fromY = ty2;
        }
      }
      const running = world.exitRunning();
      const hop = running && !reduced ? -Math.abs(Math.sin(now / 60)) * 3 * s : 0;
      door(exX, exY + hop, dw, dh, SCENE.spuz, 0);
      for (const k of world.trolls.decoy) {
        const d = world.decoyPos(k);
        const on = world.active(k);
        const since = on ? world.t - world.fired[k] - lvl.traps[k].delay : 0;
        // a mimic: the same lime door until it bites (teeth snap shut over ~5 frames), then it stays red
        const bite = on ? (reduced ? 1 : Math.min(1, (since + 1) / 5)) : 0;
        const ddx = X(d.x / FP),
          ddy = Y(d.y / FP);
        door(ddx, ddy, dw, dh, on ? palette.rage : SCENE.spuz, bite);
        if (!on && world.telegraph) {
          g.lineStyle(Math.max(1, s), palette.rage, 0.4 + 0.4 * pulse);
          g.strokeRoundedRect(ddx - 2 * s, ddy - 2 * s, dw + 4 * s, dh + 2 * s, 4 * s);
        }
      }
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
        if (world.trolls.reverse.length && world.reversed())
          ctx.label("backwards", "backwards!", cxp, feet - (b.g > 0 ? 20 : -26) * s, { color: "#FFC93C", size: 12, weight: 700 });
      }
      // particles live in world px; draw them through the camera
      // a new array only when a particle has burnt out (most frames have none to drop, or none at all)
      if (parts.length && now - parts[0].born >= 500) parts = parts.filter((p) => now - p.born < 500);
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
