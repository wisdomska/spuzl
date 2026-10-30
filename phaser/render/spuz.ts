/** Spuz drawn with plain shapes (lime blob, two eyes, antenna) and a seeded pixel burst. */
import type { Gfx } from "./types";
import { SCENE } from "./types";

export interface SpuzPose {
  /** centre x, feet y in device px */
  x: number;
  feet: number;
  /** body size in device px */
  size: number;
  facing: number;
  /** 1 normal, -1 upside down (gravity flipped) */
  up: number;
  scaleY: number;
  color: number;
  alpha: number;
  /** mouth: 0 smile, 1 shocked */
  mood: number;
}

export function drawSpuz(g: Gfx, p: SpuzPose) {
  const w = p.size * 1.08;
  const h = p.size * p.scaleY;
  const top = p.up > 0 ? p.feet - h : p.feet;
  const left = p.x - w / 2;
  g.fillStyle(p.color, p.alpha);
  g.fillRoundedRect(left, top, w, h, Math.min(w, h) * 0.38);
  // antenna on the head side
  const headY = p.up > 0 ? top : top + h;
  const ax = p.x + p.facing * w * 0.08;
  g.lineStyle(Math.max(1, p.size * 0.09), p.color, p.alpha);
  g.lineBetween(ax, headY, ax + p.facing * p.size * 0.05, headY - p.up * p.size * 0.28);
  g.fillCircle(ax + p.facing * p.size * 0.05, headY - p.up * p.size * 0.3, p.size * 0.1);
  if (p.scaleY < 0.7) return;
  // eyes look where Spuz runs
  const eyeY = p.up > 0 ? top + h * 0.38 : top + h * 0.62;
  const er = p.size * 0.17;
  for (const dx of [-0.2, 0.2]) {
    const ex = p.x + dx * w + p.facing * w * 0.08;
    g.fillStyle(SCENE.white, p.alpha);
    g.fillCircle(ex, eyeY, er);
    g.fillStyle(SCENE.ink, p.alpha);
    g.fillCircle(ex + p.facing * er * 0.35, eyeY, er * 0.55);
  }
  const my = p.up > 0 ? top + h * 0.72 : top + h * 0.28;
  g.fillStyle(SCENE.ink, p.alpha * 0.85);
  if (p.mood === 1) g.fillCircle(p.x + p.facing * w * 0.1, my, p.size * 0.08);
  else g.fillRoundedRect(p.x + p.facing * w * 0.1 - p.size * 0.12, my - p.size * 0.03, p.size * 0.24, p.size * 0.07, p.size * 0.03);
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  born: number;
}

/** Deterministic-looking burst (visual only, seeded from the death position). */
export function burst(x: number, y: number, now: number, unit: number, colors: number[]): Particle[] {
  let s = Math.floor(x * 7 + y * 13) >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000) / 1000;
  };
  return Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + rnd() * 0.4;
    const sp = (1.2 + rnd() * 2.2) * unit;
    return {
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - unit * 1.5,
      size: unit * (1.2 + rnd() * 1.4),
      color: colors[i % colors.length],
      born: now,
    };
  });
}

/** Draws and ages particles; returns the survivors. Life 500 ms. */
export function drawParticles(g: Gfx, ps: Particle[], now: number, unit: number): Particle[] {
  const out: Particle[] = [];
  for (const p of ps) {
    const t = (now - p.born) / 1000;
    if (t > 0.5) continue;
    const k = t * 60;
    const x = p.x + p.vx * k;
    const y = p.y + p.vy * k + 0.5 * 0.35 * unit * k * k;
    g.fillStyle(p.color, 1 - t / 0.5);
    g.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
    out.push(p);
  }
  return out;
}
