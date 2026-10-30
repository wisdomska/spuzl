/**
 * Deterministic tile platformer shared by Gotcha, Dash, Flipside, Ghosted, Gauntlet, Grapple and Slip.
 * AABB tile collision (axis separated), gravity with optional flip, coyote time and jump buffer,
 * moving platforms, rope swing (Grapple holds, Slip climbs), and troll traps fired by triggers.
 * All maths is integer Q8 (see fixed.ts).
 */
import { approach, clamp, FP, idiv, isqrt, overlaps, TILE, type Rect } from "./fixed";
import { BTN } from "./input";
import { EV, type SimCore } from "./core";
import { Cell, compileLevel, type CompiledLevel, type LevelDef, type PlatformDef } from "./level";

export interface PlatformerConfig {
  /** max run speed, Q8 px per frame */
  run: number;
  accelGround: number;
  accelAir: number;
  gravity: number;
  jumpVel: number;
  maxFall: number;
  /** runs right on its own (Dash, Flipside, Grapple) */
  autorun: boolean;
  /** JUMP flips gravity instead of jumping (Flipside) */
  flip: boolean;
  /** releasing JUMP early cuts the jump short */
  variableJump: boolean;
  /** rope: none, hold (Grapple: hold to hang from the nearest hook), climb (Slip: auto grab, pump, let go) */
  rope: "none" | "hold" | "climb";
  /** autorun only: running into a wall face is a death */
  wallKills: boolean;
  /** frames between a death and the respawn (300 ms) */
  respawnFrames: number;
  /** frames between clearing a level and the next one starting */
  levelPause: number;
  /** rope reach in Q8 px */
  reach: number;
  /** Slip: hanging arm length; Slip: pump acceleration; Slip: let go boost */
  arm: number;
  pump: number;
  letGo: number;
}

export const BASE_CONFIG: PlatformerConfig = {
  run: 410,
  accelGround: 140,
  accelAir: 80,
  gravity: 76,
  jumpVel: 1290,
  maxFall: 1536,
  autorun: false,
  flip: false,
  variableJump: true,
  rope: "none",
  wallKills: false,
  respawnFrames: 18,
  levelPause: 30,
  reach: 5 * TILE,
  arm: 20 * FP,
  pump: 22,
  letGo: 700,
};

export const BODY_W = 12 * FP;
export const BODY_H = 14 * FP;
const COYOTE = 6;
const BUFFER = 6;
export const EXIT_W = 14 * FP;
export const EXIT_H = 22 * FP;
export const PLAT_H = 8 * FP;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** gravity direction: 1 down, -1 up */
  g: number;
  facing: number;
  grounded: boolean;
  coyote: number;
  buffer: number;
  /** platform index the body stands on, -1 none */
  plat: number;
  /** hook index while hanging, -1 none */
  hook: number;
  len: number;
  /** Slip: frames before the last hold can be grabbed again */
  regrab: number;
  lastHook: number;
}

/** One level being played: attempts, deaths and trap state. */
export class PlatformerWorld {
  readonly lvl: CompiledLevel;
  readonly cfg: PlatformerConfig;
  /** frame within the current attempt */
  t = 0;
  body!: Body;
  /** frame each trap fired in this attempt, -1 when not fired */
  fired: Int32Array;
  triggered: Uint8Array;
  /** respawn countdown, 0 while alive */
  dead = 0;
  deaths = 0;
  done = false;
  ev = 0;
  /** where the last death happened (renderer burst) */
  deathAt = { x: 0, y: 0 };
  /** best x reached across attempts (progress, Q8) */
  bestX = 0;

  constructor(lvl: CompiledLevel, cfg: PlatformerConfig) {
    this.lvl = lvl;
    this.cfg = cfg;
    this.fired = new Int32Array(lvl.traps.length).fill(-1);
    this.triggered = new Uint8Array(lvl.triggers.length);
    this.reset();
  }

  clone(): PlatformerWorld {
    const w = Object.create(PlatformerWorld.prototype) as PlatformerWorld;
    Object.assign(w, this);
    w.body = { ...this.body };
    w.fired = this.fired.slice();
    w.triggered = this.triggered.slice();
    w.deathAt = { ...this.deathAt };
    return w;
  }

  /** Puts the runner back at the start and re-arms every trap. */
  reset() {
    const s = this.lvl.start;
    this.t = 0;
    this.fired.fill(-1);
    this.triggered.fill(0);
    this.body = {
      x: s.x * TILE + (TILE - BODY_W) / 2,
      y: (s.y + 1) * TILE - BODY_H,
      vx: 0,
      vy: 0,
      g: 1,
      facing: 1,
      grounded: false,
      coyote: 0,
      buffer: 0,
      plat: -1,
      hook: -1,
      len: 0,
      regrab: 0,
      lastHook: -1,
    };
  }

  /** True once a trap is in effect this attempt. */
  active(k: number): boolean {
    const f = this.fired[k];
    return f >= 0 && this.t >= f + this.lvl.traps[k].delay;
  }

  /** Render only: a hint revealed this room's traps. Never read by step(). */
  revealed = false;

  /** Telegraph traps once the player has died here (SRS 9.3: fair on retry), or after a hint. */
  get telegraph(): boolean {
    return this.deaths > 0 || this.revealed;
  }

  platformRect(p: PlatformDef, t = this.t): Rect {
    const P = p.period;
    const tt = (t + (p.phase ?? 0)) % P;
    const half = P / 2;
    const s = tt <= half ? tt : P - tt;
    const x = p.from[0] * TILE + idiv((p.to[0] - p.from[0]) * TILE * s, half);
    const y = p.from[1] * TILE + idiv((p.to[1] - p.from[1]) * TILE * s, half);
    return { x, y, w: p.w * TILE, h: PLAT_H };
  }

  solidCell(cx: number, cy: number): boolean {
    const { w, h, cells, trapOf, traps } = this.lvl;
    if (cx < 0 || cx >= w) return true;
    if (cy < 0 || cy >= h) return false;
    const i = cy * w + cx;
    const c = cells[i];
    if (c === Cell.Solid || c === Cell.Ledge) return true;
    if (c === Cell.Trap) {
      const k = trapOf[i];
      const kind = traps[k].kind;
      if (kind === "drop") return !this.active(k);
      if (kind === "block") return this.active(k);
    }
    return false;
  }

  /** Spike kind at a cell: 1 up, -1 down, 0 none. */
  spikeCell(cx: number, cy: number): number {
    const { w, h, cells, trapOf, traps } = this.lvl;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return 0;
    const i = cy * w + cx;
    const c = cells[i];
    if (c === Cell.SpikeUp) return 1;
    if (c === Cell.SpikeDown) return -1;
    if (c === Cell.Trap) {
      const k = trapOf[i];
      const t = traps[k];
      if (t.kind === "spikes" && this.active(k)) return t.dirs[t.cells.indexOf(i)];
    }
    return 0;
  }

  /** Every solid rect overlapping `r` (tiles, side walls and platforms). */
  solidsIn(r: Rect): Rect[] {
    const out: Rect[] = [];
    const x0 = Math.floor(r.x / TILE),
      x1 = Math.floor((r.x + r.w - 1) / TILE);
    const y0 = Math.floor(r.y / TILE),
      y1 = Math.floor((r.y + r.h - 1) / TILE);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) if (this.solidCell(cx, cy)) out.push({ x: cx * TILE, y: cy * TILE, w: TILE, h: TILE });
    for (const p of this.lvl.platforms) {
      const pr = this.platformRect(p);
      if (overlaps(r, pr)) out.push(pr);
    }
    return out;
  }

  exitPos(): { x: number; y: number } {
    let x = this.lvl.exit.x * TILE + (TILE - EXIT_W) / 2;
    let y = (this.lvl.exit.y + 1) * TILE - EXIT_H;
    this.lvl.traps.forEach((tr, k) => {
      if (tr.kind !== "exit" || this.fired[k] < 0) return;
      const tx = tr.to![0] * TILE + (TILE - EXIT_W) / 2;
      const ty = (tr.to![1] + 1) * TILE - EXIT_H;
      const s = clamp(this.t - this.fired[k] - tr.delay, 0, tr.frames!);
      x += idiv((tx - x) * s, tr.frames!);
      y += idiv((ty - y) * s, tr.frames!);
    });
    return { x, y };
  }

  /** A running door cannot be entered: it only counts once it stops. */
  exitRunning(): boolean {
    return this.lvl.traps.some((tr, k) => tr.kind === "exit" && this.fired[k] >= 0 && this.t < this.fired[k] + tr.delay + tr.frames!);
  }

  /** True when the exit has started running in this attempt (HUD label "the exit ran away"). */
  exitRan(): boolean {
    return this.lvl.traps.some((tr, k) => tr.kind === "exit" && this.active(k));
  }

  private die() {
    this.deaths++;
    this.dead = this.cfg.respawnFrames;
    this.deathAt = { x: this.body.x + BODY_W / 2, y: this.body.y + BODY_H / 2 };
    this.ev |= EV.DEATH;
  }

  private moveX(dx: number): boolean {
    const b = this.body;
    if (!dx) return false;
    const r: Rect = { x: b.x + dx, y: b.y, w: BODY_W, h: BODY_H };
    const hits = this.solidsIn(r);
    if (!hits.length) {
      b.x = r.x;
      return false;
    }
    if (dx > 0) b.x = Math.max(b.x, Math.min(...hits.map((s) => s.x)) - BODY_W);
    else b.x = Math.min(b.x, Math.max(...hits.map((s) => s.x + s.w)));
    b.vx = 0;
    return true;
  }

  /** Returns the platform index landed on, -1 for a tile, or -2 when nothing was hit. */
  private moveY(dy: number): number {
    const b = this.body;
    if (!dy) return -2;
    const r: Rect = { x: b.x, y: b.y + dy, w: BODY_W, h: BODY_H };
    const hits = this.solidsIn(r);
    if (!hits.length) {
      b.y = r.y;
      return -2;
    }
    let plat = -1;
    if (dy > 0) {
      const top = Math.min(...hits.map((s) => s.y));
      b.y = Math.max(b.y, top - BODY_H);
      plat = this.platIndexAt(hits.find((s) => s.y === top)!);
    } else {
      const bottom = Math.max(...hits.map((s) => s.y + s.h));
      b.y = Math.min(b.y, bottom);
      plat = this.platIndexAt(hits.find((s) => s.y + s.h === bottom)!);
    }
    b.vy = 0;
    return plat;
  }

  private platIndexAt(r: Rect): number {
    if (r.h !== PLAT_H) return -1;
    return this.lvl.platforms.findIndex((p) => {
      const pr = this.platformRect(p);
      return pr.x === r.x && pr.y === r.y;
    });
  }

  private bodyRect(): Rect {
    return { x: this.body.x, y: this.body.y, w: BODY_W, h: BODY_H };
  }

  private touchesSpike(): boolean {
    const b = this.body;
    const hurt: Rect = { x: b.x + FP, y: b.y + FP, w: BODY_W - 2 * FP, h: BODY_H - 2 * FP };
    const x0 = Math.floor(hurt.x / TILE),
      x1 = Math.floor((hurt.x + hurt.w - 1) / TILE);
    const y0 = Math.floor(hurt.y / TILE),
      y1 = Math.floor((hurt.y + hurt.h - 1) / TILE);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const s = this.spikeCell(cx, cy);
        if (!s) continue;
        const kill: Rect = { x: cx * TILE + 3 * FP, y: cy * TILE + (s > 0 ? 7 * FP : 0), w: 10 * FP, h: 9 * FP };
        if (overlaps(hurt, kill)) return true;
      }
    return false;
  }

  private nearestHook(): number {
    const b = this.body;
    const cx = b.x + BODY_W / 2,
      cy = b.y + BODY_H / 2;
    let best = -1,
      bestD = Infinity;
    this.lvl.hooks.forEach((h, i) => {
      const hx = h.x * TILE + TILE / 2,
        hy = h.y * TILE + TILE / 2;
      const dx = hx - cx,
        dy = hy - cy;
      if (this.cfg.rope === "hold" && (dy > 0 || dx < -TILE)) return; // hooks above and ahead
      if (this.cfg.rope === "climb" && i === b.lastHook && b.regrab > 0) return;
      const d = dx * dx + dy * dy;
      const r = this.cfg.rope === "climb" ? 12 * FP : this.cfg.reach;
      if (d <= r * r && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /** One fixed step. `prev` is the previous frame's buttons (edge detection). */
  step(buttons: number, prev: number) {
    this.ev = 0;
    if (this.done) return;
    if (this.dead > 0) {
      this.dead--;
      if (!this.dead) {
        this.reset();
        this.ev |= EV.RESPAWN;
      }
      return;
    }
    const cfg = this.cfg;
    const b = this.body;
    this.t++;
    const pressed = (buttons & BTN.JUMP) !== 0 && (prev & BTN.JUMP) === 0;
    const held = (buttons & BTN.JUMP) !== 0;
    const dir = (buttons & BTN.RIGHT ? 1 : 0) - (buttons & BTN.LEFT ? 1 : 0);
    if (b.regrab > 0) b.regrab--;

    // Platforms move first and carry whoever stands on them.
    if (b.plat >= 0) {
      const p = this.lvl.platforms[b.plat];
      const a = this.platformRect(p, this.t - 1),
        c = this.platformRect(p, this.t);
      this.moveX(c.x - a.x);
      if (c.y - a.y) this.moveY(c.y - a.y);
    }
    // A moving platform that runs into the body pushes it out of the way.
    this.lvl.platforms.forEach((p, k) => {
      const c = this.platformRect(p);
      if (!overlaps(this.bodyRect(), c)) return;
      const a = this.platformRect(p, this.t - 1);
      if (c.y < a.y) {
        b.y = c.y - BODY_H;
        if (b.vy > 0) b.vy = 0;
        b.grounded = true;
        b.plat = k;
      } else if (c.y > a.y) {
        b.y = c.y + c.h;
        if (b.vy < 0) b.vy = 0;
      } else if (c.x > a.x) b.x = c.x + c.w;
      else if (c.x < a.x) b.x = c.x - BODY_W;
    });
    if (this.solidsIn(this.bodyRect()).length) return this.die(); // crushed

    const wasGrounded = b.grounded;
    b.buffer = pressed ? BUFFER : Math.max(0, b.buffer - 1);
    b.coyote = b.grounded ? COYOTE : Math.max(0, b.coyote - 1);

    // Rope: grab, hang, let go.
    if (cfg.rope !== "none" && b.hook < 0 && !b.grounded) {
      const want = cfg.rope === "hold" ? held : true;
      if (want) {
        const h = this.nearestHook();
        if (h >= 0) {
          const hk = this.lvl.hooks[h];
          const dx = b.x + BODY_W / 2 - (hk.x * TILE + TILE / 2),
            dy = b.y + BODY_H / 2 - (hk.y * TILE + TILE / 2);
          b.hook = h;
          b.len = cfg.rope === "climb" ? cfg.arm : Math.max(2 * TILE, isqrt(dx * dx + dy * dy));
          b.buffer = 0;
          this.ev |= EV.GRAB;
        }
      }
    }
    if (b.hook >= 0) {
      const release = cfg.rope === "hold" ? !held : pressed;
      if (release) {
        if (cfg.rope === "climb") {
          b.vy -= cfg.letGo;
          b.regrab = 14;
          b.lastHook = b.hook;
        }
        b.hook = -1;
        b.buffer = 0;
      }
    }

    if (b.hook >= 0) {
      if (cfg.rope === "climb" && dir) b.vx += dir * cfg.pump;
      b.vy = Math.min(b.vy + cfg.gravity, cfg.maxFall);
      const hk = this.lvl.hooks[b.hook];
      const hx = hk.x * TILE + TILE / 2,
        hy = hk.y * TILE + TILE / 2;
      let nx = b.x + BODY_W / 2 + b.vx - hx,
        ny = b.y + BODY_H / 2 + b.vy - hy;
      const d = isqrt(nx * nx + ny * ny);
      if (d > b.len && d > 0) {
        const vr = idiv(b.vx * nx + b.vy * ny, d);
        if (vr > 0) {
          b.vx -= idiv(vr * nx, d);
          b.vy -= idiv(vr * ny, d);
        }
        nx = idiv(nx * b.len, d);
        ny = idiv(ny * b.len, d);
      }
      if (cfg.rope === "climb") b.vx -= idiv(b.vx, 64); // arms are tired: a little drag
      const tx = hx + nx - BODY_W / 2,
        ty = hy + ny - BODY_H / 2;
      if (this.moveX(tx - b.x)) b.vx = 0;
      if (this.moveY(ty - b.y) !== -2) b.vy = 0;
      if (b.vx) b.facing = b.vx > 0 ? 1 : -1;
      b.grounded = false;
      b.plat = -1;
    } else {
      // Horizontal
      if (cfg.autorun) {
        b.vx = b.grounded || cfg.flip ? cfg.run : cfg.rope === "none" ? approach(b.vx, cfg.run, cfg.accelAir) : b.vx;
        b.facing = 1;
      } else {
        const target = dir * cfg.run;
        b.vx = approach(b.vx, target, b.grounded ? cfg.accelGround : cfg.accelAir);
        if (dir) b.facing = dir;
      }
      // Jump or flip
      if (b.buffer && b.coyote) {
        if (cfg.flip) {
          b.g = -b.g;
          b.vy = b.g * 2 * FP;
          this.ev |= EV.FLIP;
        } else {
          b.vy = -cfg.jumpVel * b.g;
          this.ev |= EV.JUMP;
        }
        b.buffer = 0;
        b.coyote = 0;
        b.grounded = false;
        b.plat = -1;
      }
      if (cfg.variableJump && !held && b.vy * b.g < -idiv(cfg.jumpVel * 2, 5)) b.vy = -idiv(cfg.jumpVel * 2, 5) * b.g;
      b.vy = clamp(b.vy + cfg.gravity * b.g, -cfg.maxFall, cfg.maxFall);

      const hitWall = this.moveX(b.vx);
      if (hitWall && cfg.autorun && cfg.wallKills) return this.die();
      const vyBefore = b.vy;
      const landed = this.moveY(b.vy);
      b.grounded = landed !== -2 && vyBefore * b.g > 0;
      b.plat = b.grounded ? landed : -1;
      if (!b.grounded && landed === -2 && wasGrounded) {
        // Still standing? Probe one sub-unit toward gravity.
        const probe: Rect = { x: b.x, y: b.y + b.g, w: BODY_W, h: BODY_H };
        const under = this.solidsIn(probe);
        if (under.length && b.vy * b.g >= 0) {
          b.grounded = true;
          b.plat = this.platIndexAt(under[0]);
        }
      }
      if (b.grounded && !wasGrounded) this.ev |= EV.LAND;
    }

    // Hazards
    const lvlH = this.lvl.h * TILE;
    if (b.y > lvlH + 2 * TILE || b.y + BODY_H < -2 * TILE) return this.die();
    if (this.touchesSpike()) return this.die();

    // Triggers
    const r = this.bodyRect();
    this.lvl.triggers.forEach((tr, i) => {
      if (this.triggered[i] || !overlaps(r, tr)) return;
      this.triggered[i] = 1;
      for (const k of tr.fire) if (this.fired[k] < 0) this.fired[k] = this.t;
    });
    this.lvl.traps.forEach((tr, k) => {
      if (this.fired[k] >= 0 && this.t === this.fired[k] + tr.delay) this.ev |= tr.kind === "exit" ? EV.EXIT_RUN : EV.TRAP;
    });
    if (this.solidsIn(this.bodyRect()).length) return this.die(); // a block appeared inside the runner

    if (b.x > this.bestX) this.bestX = b.x;
    const ex = this.exitPos();
    if (!this.exitRunning() && overlaps(r, { x: ex.x, y: ex.y, w: EXIT_W, h: EXIT_H })) {
      this.done = true;
      this.ev |= EV.CLEAR;
    }
  }
}

/** A course of levels played back to back with one input log. */
export class PlatformerCourse implements SimCore {
  readonly levels: CompiledLevel[];
  readonly cfg: PlatformerConfig;
  idx = 0;
  world: PlatformerWorld;
  frame = 0;
  deaths = 0;
  finished = false;
  ev = 0;
  /** frames left in the between-levels pause */
  pause = 0;
  prev = 0;
  /** frames spent on each cleared level */
  splits: number[] = [];
  private levelStart = 0;

  constructor(levels: (LevelDef | CompiledLevel)[], cfg: PlatformerConfig) {
    this.levels = levels.map((l) => ("cells" in l ? l : compileLevel(l)));
    this.cfg = cfg;
    this.world = new PlatformerWorld(this.levels[0], cfg);
  }

  step(buttons: number) {
    this.ev = 0;
    if (this.finished) return;
    this.frame++;
    if (this.pause > 0) {
      this.pause--;
      if (!this.pause) {
        this.idx++;
        this.world = new PlatformerWorld(this.levels[this.idx], this.cfg);
        this.levelStart = this.frame;
      }
      this.prev = buttons;
      return;
    }
    this.world.step(buttons, this.prev);
    this.ev = this.world.ev;
    if (this.ev & EV.DEATH) this.deaths++;
    if (this.world.done) {
      this.splits.push(this.frame - this.levelStart);
      if (this.idx === this.levels.length - 1) {
        this.finished = true;
        this.ev |= EV.FINISH;
      } else this.pause = this.cfg.levelPause;
    }
    this.prev = buttons;
  }

  cleared() {
    return this.splits.length;
  }

  score() {
    return 0;
  }

  /** Fine progress: cleared levels plus the share of the current level's width covered. */
  progress() {
    if (this.finished) return 1;
    const lvl = this.world.lvl;
    const startX = lvl.start.x * TILE;
    const span = Math.max(TILE, Math.abs(lvl.exit.x * TILE - startX));
    const part = this.world.done ? 1 : clamp(Math.abs(this.world.body.x - startX) / span, 0, 0.99);
    return (this.idx + part) / this.levels.length;
  }

  /** Metres run so far (1 tile = 1 m), for the Dash and Ghosted HUD. */
  metres() {
    let m = 0;
    for (let i = 0; i < this.idx; i++) m += this.levels[i].w;
    return m + Math.max(0, Math.floor(this.world.body.x / TILE));
  }

  /** Plain-language warning for the current room's first trap (hints). */
  static trapHint(lvl: CompiledLevel): string {
    const kinds = new Set(lvl.traps.map((t) => t.kind));
    if (kinds.has("drop")) return "A floor ahead is fake. The cracked tiles fall, so jump over them.";
    if (kinds.has("spikes")) return "Spikes pop up ahead. The outlines show where, so land somewhere else.";
    if (kinds.has("exit")) return "The door runs when you get close. The dotted line shows where it goes.";
    if (kinds.has("block")) return "A hidden block waits in the air. The outline shows where.";
    return "This room tells the truth. Just go.";
  }

  clone(): PlatformerCourse {
    const c = Object.create(PlatformerCourse.prototype) as PlatformerCourse;
    Object.assign(c, this);
    c.world = this.world.clone();
    c.splits = this.splits.slice();
    return c;
  }
}
