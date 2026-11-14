"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type RageGameSpec } from "@/phaser/RageBoard";
import { createPlatformerPainter, FIT_EDGE, FIT_TOP } from "@/phaser/render/platformer";
import { roomStageHeight } from "@/phaser/layout";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { PlatformerCourse } from "@/phaser/sim/platformer";
import { createSim } from "./logic";
import { ROOM_COLS, ROOM_ROWS } from "./rooms";

/** Whole-room view: a 24 x 14 room fits the canvas at once, so every trap reads before it bites. */
const painter = () => createPlatformerPainter({ fit: { cols: ROOM_COLS, rows: ROOM_ROWS } });

/** Gotcha board (Game Boards: Gotcha): one-screen troll rooms, D-pad and JUMP under the canvas. */
const SPEC: RageGameSpec<PlatformerCourse> = {
  name: "Gotcha",
  createSim,
  painter,
  stageHeight: (w, vp) => roomStageHeight(w, vp, ROOM_COLS, ROOM_ROWS, FIT_TOP + 3 * FIT_EDGE),
  controls: "dpad",
  hud: "deaths",
  startHint: "Move or jump to start. Trust nothing.",
  levelName: (sim) => sim.levels[sim.idx].def.name,
  deathLines: [
    "Spuz has seen worse. Barely.",
    "The room was lying. Rooms do that.",
    "Now you know. Go again.",
    "Spuz believes in you. Mostly.",
    "Gotcha. Look again, it shows its tricks now.",
    "That one was rude. Next try is yours.",
    "Spuz is fine. Spuz is bouncy.",
    "Plot twist. Again.",
  ],
  demoLog: async (p) => {
    const [{ courseLog }, { default: SOLUTIONS }, { default: LEGACY }, { CONFIG }] = await Promise.all([
      import("@/phaser/sim/scripted"),
      import("./solutions.json"),
      import("./legacy-solutions.json"),
      import("./levels"),
    ]);
    return courseLog(p.levels, { ...LEGACY, ...SOLUTIONS }, CONFIG.levelPause);
  },
  reveal: (sim) => {
    sim.world.revealed = true;
  },
};

export default function GotchaBoard(props: BoardProps<CoursePuzzle, RageState>) {
  return <RageBoard {...props} spec={SPEC} />;
}
