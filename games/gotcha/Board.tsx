"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type RageGameSpec } from "@/phaser/RageBoard";
import { createPlatformerPainter, FIT_EDGE, FIT_TOP } from "@/phaser/render/platformer";
import { roomStageHeight } from "@/phaser/layout";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { PlatformerCourse } from "@/phaser/sim/platformer";
import { createSim } from "./logic";

/**
 * The camera shows a 16 x 10 tile window of a 24 x 14 room and follows Spuz, so the door and the traps come into
 * view as you go. Tiles stay small (a whole number of device px each).
 */
const VIEW = { cols: 16, rows: 10 };
const painter = () => createPlatformerPainter({ fit: VIEW });

/** Gotcha board (Game Boards: Gotcha): one-screen troll rooms, D-pad and JUMP under the canvas. */
const SPEC: RageGameSpec<PlatformerCourse> = {
  name: "Gotcha",
  createSim,
  painter,
  stageHeight: (w, vp) => roomStageHeight(w, vp, VIEW.cols, VIEW.rows, FIT_TOP + 3 * FIT_EDGE),
  // A wide screen gets the full width, as Dash does (owner, 19 Nov 2026): the tiles grow to the height and the
  // window shows a few more columns, so the room still scrolls and its traps still come into view as you go.
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
