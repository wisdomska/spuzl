"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type GhostSpec, type RageGameSpec } from "@/phaser/RageBoard";
import { createPlatformerPainter } from "@/phaser/render/platformer";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { PlatformerCourse } from "@/phaser/sim/platformer";
import { createSim } from "./logic";

/** Dash board (Game Boards: Dash): auto-runner, tap anywhere or JUMP, metres and course bar; Ghost Race ready. */
const SPEC: RageGameSpec<PlatformerCourse> = {
  name: "Dash",
  createSim,
  painter: () => createPlatformerPainter({ slab: true }),
  controls: "tap",
  hud: "distance",
  startHint: "Tap or press Space to run",
  levelName: (sim) => sim.levels[sim.idx].def.name,
  metres: (sim) => sim.metres(),
  demoLog: async (p) => {
    const [{ courseLog }, { default: SOLUTIONS }, { CONFIG }] = await Promise.all([
      import("@/phaser/sim/scripted"),
      import("./solutions.json"),
      import("./levels"),
    ]);
    return courseLog(p.levels, SOLUTIONS, CONFIG.levelPause);
  },
};

export default function DashBoard(props: BoardProps<CoursePuzzle, RageState> & { ghost?: GhostSpec | null }) {
  return <RageBoard {...props} spec={SPEC} />;
}
