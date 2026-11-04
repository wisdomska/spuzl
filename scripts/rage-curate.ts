/**
 * Re-curates a course ladder for variety (lib/game/rage-variety.ts) without re-solving any room: every generated
 * room keeps its bot-proved solution, the ladder only drops and reorders.
 *
 * Usage: pnpm tsx scripts/rage-curate.ts <gotcha|runner> [--all] [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import type { LevelDef } from "@/phaser/sim/level";
import { curate, motif } from "@/lib/game/rage-variety";
import { logFromFrames, scriptFromLog } from "@/phaser/sim/input";
import type { PlatformerConfig } from "@/phaser/sim/platformer";
import { solve } from "./rage-design";

async function main() {
  const arg = process.argv[2];
  const id = arg === "runner" ? "dash" : arg;
  if (id !== "gotcha" && id !== "dash") throw new Error("usage: rage-curate <gotcha|runner>");
  const mod = (await import(`../games/${id}/levels`)) as {
    HAND_LEVELS: LevelDef[];
    SET_PIECES: LevelDef[];
    CONFIG: PlatformerConfig;
  };
  const gen = (await import(`../games/${id}/levels.generated`)) as { GENERATED: LevelDef[]; LADDER: string[] };
  const all = [...mod.HAND_LEVELS, ...mod.SET_PIECES, ...gen.GENERATED];
  const byId = new Map(all.map((l) => [l.id, l]));
  const fixed = new Set([...mod.HAND_LEVELS, ...mod.SET_PIECES].map((l) => l.id));
  // --all: curate every generated room again (in the designer's tier order), not only the current ladder
  const order = process.argv.includes("--all") ? gen.GENERATED.map((l) => l.id) : gen.LADDER;
  const ladder = curate(order, byId, fixed);
  if (process.argv.includes("--dry")) {
    ladder.forEach((x, i) => console.log(i + 1, x, motif(byId.get(x)!)));
    return;
  }
  // dropped rooms leave the file and solutions.json (the tests hold both to the ladder); hand rooms and set pieces
  // keep their scripts, in the ladder or not
  const keep = new Set([...ladder, ...fixed]);
  const file = path.resolve(`games/${id}/levels.generated.ts`);
  const src = readFileSync(file, "utf8");
  const head = src.slice(0, src.indexOf("export const GENERATED"));
  const generated = gen.GENERATED.filter((l) => keep.has(l.id));
  writeFileSync(
    file,
    `${head}export const GENERATED: LevelDef[] = ${JSON.stringify(generated)};\n\n` +
      `/** Level ladder order (Level 1 first): hand rooms, set pieces and generated rooms by difficulty. */\n` +
      `export const LADDER: string[] = ${JSON.stringify(ladder)};\n`,
  );
  const solFile = path.resolve(`games/${id}/solutions.json`);
  const solutions = JSON.parse(readFileSync(solFile, "utf8")) as Record<string, unknown>;
  for (const key of Object.keys(solutions)) if (!keep.has(key)) delete solutions[key];
  // rooms back in the ladder get their bot script again (the designer proved them; the solver is deterministic)
  for (const l of ladder.map((x) => byId.get(x)!))
    if (!solutions[l.id]) {
      const frames = solve(l, mod.CONFIG);
      if (!frames) throw new Error(`${l.id}: no solution`);
      solutions[l.id] = scriptFromLog(logFromFrames(frames));
      console.log(`solved ${l.id}`);
    }
  const body = Object.entries(solutions)
    .map(([key, v]) => `  ${JSON.stringify(key)}: ${JSON.stringify(v)}`)
    .join(",\n");
  writeFileSync(solFile, `{\n${body}\n}\n`);
  execFileSync("pnpm", ["prettier", "--write", file, solFile], { stdio: "ignore" });
  console.log(`${id}: ${gen.LADDER.length} rooms, ${ladder.length} in the ladder`);
}

if (process.argv[1]?.endsWith("rage-curate.ts")) void main();
