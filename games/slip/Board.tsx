"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type RageGameSpec } from "@/phaser/RageBoard";
import { createPlatformerPainter } from "@/phaser/render/platformer";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { PlatformerCourse } from "@/phaser/sim/platformer";
import { createSim } from "./logic";

/** Slip board: drag on the canvas (or left and right) to swing, LET GO (Space) to hop off a hold. */
const SPEC: RageGameSpec<PlatformerCourse> = {
  name: "Slip",
  createSim,
  painter: () => createPlatformerPainter({ viewRows: 12 }),
  tall: true,
  controls: "drag",
  action: "Let go",
  hud: "deaths",
  startHint: "Jump to the first hold, drag to swing",
  levelName: (sim) => sim.levels[sim.idx].def.name,
  demoLog: async (p) => {
    const [{ courseLog }, { default: SOLUTIONS }, { CONFIG }] = await Promise.all([
      import("@/phaser/sim/scripted"),
      import("./solutions.json"),
      import("./levels"),
    ]);
    return courseLog(p.levels, SOLUTIONS, CONFIG.levelPause);
  },
};

export default function SlipBoard(props: BoardProps<CoursePuzzle, RageState>) {
  return <RageBoard {...props} spec={SPEC} />;
}
