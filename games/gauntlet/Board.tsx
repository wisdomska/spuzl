"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type RageGameSpec } from "@/phaser/RageBoard";
import { createPlatformerPainter } from "@/phaser/render/platformer";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { PlatformerCourse } from "@/phaser/sim/platformer";
import { createSim } from "./logic";

/** Gauntlet board: 10 tiny troll rooms back to back, D-pad and JUMP, deaths counter front and centre. */
const SPEC: RageGameSpec<PlatformerCourse> = {
  name: "Gauntlet",
  createSim,
  painter: createPlatformerPainter,
  controls: "dpad",
  hud: "deaths",
  startHint: "Ten rooms. Move or jump to start",
  levelName: (sim) => sim.levels[sim.idx].def.name,
  deathLines: ["Spuz has seen worse. Barely.", "The room was lying.", "Now you know. Go again.", "Spuz believes in you. Mostly."],
  demoLog: async (p) => {
    const [{ courseLog }, { default: SOLUTIONS }, { CONFIG }] = await Promise.all([
      import("@/phaser/sim/scripted"),
      import("./solutions.json"),
      import("./levels"),
    ]);
    return courseLog(p.levels, SOLUTIONS, CONFIG.levelPause);
  },
  reveal: (sim) => {
    sim.world.revealed = true;
  },
};

export default function GauntletBoard(props: BoardProps<CoursePuzzle, RageState>) {
  return <RageBoard {...props} spec={SPEC} />;
}
