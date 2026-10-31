/**
 * Beam search that finds a no-death input script for one level. Tooling only (scripts/rage-solve.ts
 * writes the results into games/<id>/solutions.ts); never imported by the client.
 */
import { TILE } from "./fixed";
import { BTN } from "./input";
import type { SimCore } from "./core";
import { PlatformerCourse } from "./platformer";

export interface Searchable extends SimCore {
  clone(): this;
}

export interface SearchOptions<C extends Searchable> {
  actions: number[];
  /** frames per action */
  macro: number;
  beam: number;
  maxFrames: number;
  heuristic(c: C): number;
  key(c: C): string;
  /** coarse bucket for diversity: at most `perBucket` states per bucket survive a layer */
  bucket?(c: C): string;
  perBucket?: number;
  /** allow deaths (score games) */
  allowDeath?: boolean;
}

interface Node<C> {
  sim: C;
  parent: Node<C> | null;
  action: number;
  n: number;
  h: number;
}

/** Returns one button mask per frame that finishes the course, or null. */
export function beamSearch<C extends Searchable>(start: C, o: SearchOptions<C>): number[] | null {
  let layer: Node<C>[] = [{ sim: start, parent: null, action: 0, n: 0, h: o.heuristic(start) }];
  const unwind = (node: Node<C>) => {
    const out: number[] = [];
    for (let k: Node<C> | null = node; k && k.parent; k = k.parent) for (let i = 0; i < k.n; i++) out.push(k.action);
    return out.reverse();
  };
  for (let depth = 0; depth * o.macro < o.maxFrames; depth++) {
    const next = new Map<string, Node<C>>();
    for (const node of layer) {
      for (const a of o.actions) {
        const sim = node.sim.clone();
        const d0 = sim.deaths;
        let n = 0;
        let dead = false;
        for (; n < o.macro; n++) {
          sim.step(a);
          if (!o.allowDeath && sim.deaths > d0) {
            dead = true;
            break;
          }
          if (sim.finished) {
            n++;
            break;
          }
        }
        if (dead) continue;
        const child: Node<C> = { sim, parent: node, action: a, n, h: o.heuristic(sim) };
        if (sim.finished) return unwind(child);
        const k = o.key(sim);
        const prev = next.get(k);
        if (!prev || prev.h < child.h) next.set(k, child);
      }
    }
    const sorted = [...next.values()].sort((a, b) => b.h - a.h);
    if (o.bucket) {
      const count = new Map<string, number>();
      layer = [];
      for (const n of sorted) {
        const b = o.bucket(n.sim);
        const c = count.get(b) ?? 0;
        if (c >= (o.perBucket ?? 4)) continue;
        count.set(b, c + 1);
        layer.push(n);
        if (layer.length >= o.beam) break;
      }
    } else layer = sorted.slice(0, o.beam);
    if (process.env.RAGE_DEBUG)
      console.log(
        depth,
        layer.length,
        layer
          .slice(0, 3)
          .map((n) => o.key(n.sim) + " h" + n.h.toFixed(2))
          .join("  "),
      );
    if (!layer.length) return null;
  }
  return null;
}

const { LEFT: L, RIGHT: R, JUMP: J } = BTN;

/** Default search for a single-level platformer course. */
export function solvePlatformer(course: PlatformerCourse, opts: Partial<SearchOptions<PlatformerCourse>> = {}): number[] | null {
  const cfg = course.cfg;
  const actions = cfg.autorun || cfg.flip ? [0, J] : cfg.rope === "climb" ? [0, L, R, J, L | J, R | J] : [0, R, R | J, L, L | J, J];
  const key = (c: PlatformerCourse) => {
    const w = c.world,
      b = w.body;
    const traps = Array.from(w.fired, (f, k) => (f < 0 ? 0 : w.active(k) ? 2 : 1)).join("");
    return `${c.idx}|${b.x >> 9}|${b.y >> 9}|${b.vx >> 7}|${b.vy >> 7}|${b.g}|${b.hook}|${c.pause}|${traps}`;
  };
  const bucket = (c: PlatformerCourse) => {
    const w = c.world,
      b = w.body;
    const traps = Array.from(w.fired, (f) => (f < 0 ? 0 : 1)).join("");
    return `${b.x >> 12}|${b.y >> 12}|${b.hook >= 0 ? 1 : 0}|${traps}`;
  };
  const heuristic = (c: PlatformerCourse) => {
    const w = c.world,
      b = w.body;
    const e = w.exitPos();
    const dx = Math.abs(e.x - b.x),
      dy = Math.abs(e.y - b.y);
    return c.idx * 1e9 - (dx + dy * 1.5) / TILE - w.t * 0.01;
  };
  return beamSearch(course, {
    actions,
    macro: 4,
    beam: 300,
    maxFrames: 60 * 120,
    heuristic,
    key,
    bucket,
    perBucket: 6,
    ...(cfg.autorun || cfg.flip ? { macro: 2 } : {}),
    ...opts,
  });
}
