/**
 * Finds a no-death scripted solution for every level of a Rage Ridge tile game and writes
 * games/<id>/solutions.json. Usage: pnpm tsx scripts/rage-solve.ts gotcha [levelId]
 * The tests replay these scripts to prove every level is completable without a forced death.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PlatformerCourse, type PlatformerConfig } from "@/phaser/sim/platformer";
import { solvePlatformer } from "@/phaser/sim/solver";
import { logFromFrames, scriptFromLog } from "@/phaser/sim/input";
import type { LevelDef } from "@/phaser/sim/level";

async function main() {
  const [id, only, beamArg] = process.argv.slice(2);
  if (!id) throw new Error("usage: rage-solve <game> [levelId] [beam]");
  const levelsMod = (await import(`@/games/${id}/levels`)) as { LEVELS: LevelDef[]; CONFIG: PlatformerConfig };
  const file = path.resolve(`games/${id}/solutions.json`);
  const existing: Record<string, [number, number][]> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const beam = beamArg ? Number(beamArg) : 300;
  for (const lvl of levelsMod.LEVELS) {
    if (only && only !== "all" && lvl.id !== only) continue;
    const t0 = Date.now();
    const course = new PlatformerCourse([lvl], levelsMod.CONFIG);
    const frames = solvePlatformer(course, { beam });
    if (!frames) {
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
}

void main();
