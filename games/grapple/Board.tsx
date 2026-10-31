"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type RageGameSpec } from "@/phaser/RageBoard";
import { createPlatformerPainter } from "@/phaser/render/platformer";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { PlatformerCourse } from "@/phaser/sim/platformer";
import { createSim } from "./logic";

/** Grapple board: hold anywhere (or HOLD, Space) to hook, let go to fly. */
const SPEC: RageGameSpec<PlatformerCourse> = {
  name: "Grapple",
  createSim,
  painter: () => createPlatformerPainter({ viewRows: 10 }),
  tall: true,
  controls: "hold",
  action: "Hold",
  hud: "distance",
  startHint: "Hold to hook, let go to fly",
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

export default function GrappleBoard(props: BoardProps<CoursePuzzle, RageState>) {
  return <RageBoard {...props} spec={SPEC} />;
}
