"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type GhostSpec, type RageGameSpec } from "@/phaser/RageBoard";
import { createPlatformerPainter } from "@/phaser/render/platformer";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { PlatformerCourse } from "@/phaser/sim/platformer";
import { createSim } from "./logic";

/** Flipside board: auto-run corridor with floor and ceiling in view, tap anywhere or FLIP. */
const SPEC: RageGameSpec<PlatformerCourse> = {
  name: "Flipside",
  createSim,
  painter: () => createPlatformerPainter({ viewRows: 10.5 }),
  tall: true,
  controls: "tap",
  action: "Flip",
  hud: "distance",
  startHint: "Tap or press Space to flip",
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

export default function FlipsideBoard(props: BoardProps<CoursePuzzle, RageState> & { ghost?: GhostSpec | null }) {
  return <RageBoard {...props} spec={SPEC} />;
}
