"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type GhostSpec, type RageGameSpec } from "@/phaser/RageBoard";
import { createPlatformerPainter } from "@/phaser/render/platformer";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { PlatformerCourse } from "@/phaser/sim/platformer";
import { createSim } from "./logic";

/**
 * Ghosted board (Overlays: GR Ghost Race). Pass `ghost` (a friend's best InputLog and name) and it runs
 * in parallel through the same sim as a translucent runner with a name tag; it never collides.
 */
const SPEC: RageGameSpec<PlatformerCourse> = {
  name: "Ghosted",
  createSim,
  painter: createPlatformerPainter,
  controls: "dpad",
  hud: "race",
  tall: true,
  startHint: "Move or jump to start the race",
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

export default function GhostedBoard(props: BoardProps<CoursePuzzle, RageState> & { ghost?: GhostSpec | null }) {
  return <RageBoard {...props} spec={SPEC} />;
}
