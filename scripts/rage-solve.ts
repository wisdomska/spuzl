/**
 * Finds a no-death scripted solution for every level of a Rage Ridge tile game and writes
 * games/<id>/solutions.json. Usage: pnpm tsx scripts/rage-solve.ts gotcha [levelId|all] [beam]
 * The tests replay these scripts to prove every level is completable without a forced death.
 *
 * A levels module may export GUIDES (level id to waypoints, in tiles): rooms whose way out doubles back (the door
 * ran off behind you, the real door is up top) send the search through each waypoint in turn before the exit. A game
 * that exports GUIDES also keys its search on time, so a route that waits for a trap to pass is not merged away.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { TILE } from "@/phaser/sim/fixed";
import { PlatformerCourse, type PlatformerConfig } from "@/phaser/sim/platformer";
import { solvePlatformer } from "@/phaser/sim/solver";
import { logFromFrames, scriptFromLog } from "@/phaser/sim/input";
import type { LevelDef } from "@/phaser/sim/level";

type Guided = PlatformerCourse & { stage?: number };

/** Search options that walk the waypoints first (the stage rides on the course, so clones carry it). */
function guided(points: [number, number][]) {
  const at = (c: Guided) => {
    const b = c.world.body;
    let st = c.stage ?? 0;
    while (st < points.length) {
      const [x, y] = points[st];
      const dx = Math.abs(b.x + 6 * 256 - (x * TILE + TILE / 2)),
        dy = Math.abs(b.y + 7 * 256 - (y * TILE + TILE / 2));
      if (dx > TILE || dy > TILE) break;
      st++;
    }
    c.stage = st;
    return st;
  };
  return {
    heuristic: (c: Guided) => {
      const st = at(c);
      const w = c.world,
        b = w.body;
      const target = st < points.length ? { x: points[st][0] * TILE, y: points[st][1] * TILE } : w.exitPos();
      const dx = Math.abs(target.x - b.x),
        dy = Math.abs(target.y - b.y);
      return c.idx * 1e9 + st * 1e6 - (dx + dy * 1.5) / TILE - w.t * 0.01;
    },
    key: (c: Guided) => {
      const w = c.world,
        b = w.body;
      const traps = Array.from(w.fired, (f, k) => (f < 0 ? 0 : w.active(k) ? 2 : 1)).join("");
      return `${c.stage ?? 0}|${b.x >> 9}|${b.y >> 9}|${b.vx >> 7}|${b.vy >> 7}|${b.g}|${traps}|${w.t >> 4}`;
    },
    bucket: (c: Guided) => {
      const b = c.world.body;
      return `${c.stage ?? 0}|${b.x >> 12}|${b.y >> 12}`;
    },
  };
}

async function main() {
  const [id, only, beamArg] = process.argv.slice(2);
  if (!id) throw new Error("usage: rage-solve <game> [levelId] [beam]");
  const levelsMod = (await import(`@/games/${id}/levels`)) as {
    LEVELS: LevelDef[];
    CONFIG: PlatformerConfig;
    GUIDES?: Record<string, [number, number][]>;
  };
  const file = path.resolve(`games/${id}/solutions.json`);
  const existing: Record<string, [number, number][]> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const beam = beamArg ? Number(beamArg) : 300;
  let failed = 0;
  for (const lvl of levelsMod.LEVELS) {
    if (only && only !== "all" && lvl.id !== only) continue;
    const t0 = Date.now();
    // a game that exports GUIDES searches every room this way (its key keeps time, so waiting out a trap survives)
    const opts = { beam, ...(levelsMod.GUIDES ? guided(levelsMod.GUIDES[lvl.id] ?? []) : {}) };
    const frames =
      solvePlatformer(new PlatformerCourse([lvl], levelsMod.CONFIG), opts as never) ??
      solvePlatformer(new PlatformerCourse([lvl], levelsMod.CONFIG), { ...opts, macro: 2 } as never);
    if (!frames) {
      failed++;
      console.log(`${lvl.id}: NO SOLUTION (${Date.now() - t0} ms)`);
      continue;
    }
    existing[lvl.id] = scriptFromLog(logFromFrames(frames));
    console.log(`${lvl.id}: ${frames.length} frames (${Date.now() - t0} ms)`);
  }
  const body = Object.entries(existing)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(",\n");
  writeFileSync(file, `{\n${body}\n}\n`);
  if (failed) process.exitCode = 1;
}

void main();
