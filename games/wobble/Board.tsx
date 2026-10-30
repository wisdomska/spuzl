"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type RageGameSpec } from "@/phaser/RageBoard";
import { createWobblePainter } from "@/phaser/render/wobble";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { WobbleSim } from "@/phaser/sim/wobble";
import { createSim } from "./logic";

/** Wobble board: tap left and right under the canvas (or arrows, A D, gamepad) to keep Spuz upright. */
const SPEC: RageGameSpec<WobbleSim> = {
  name: "Wobble",
  createSim,
  painter: createWobblePainter,
  controls: "lr",
  hud: "deaths",
  deathNoun: "Fall",
  deathLines: ["The wind wins this one.", "Lean into the gust next time.", "Shake it off. Go again.", "Spuz believes in you. Mostly."],
  startHint: "Tap left or right to start walking",
  levelName: (sim) => sim.rope().name,
  finishCopy: (sim) => `Across every rope with ${sim.deaths} ${sim.deaths === 1 ? "fall" : "falls"}.`,
  demoLog: async (p) => {
    const [{ botFrames }, { logFromFrames }] = await Promise.all([import("./bot"), import("@/phaser/sim/input")]);
    return logFromFrames(botFrames(createSim(p)));
  },
};

export default function WobbleBoard(props: BoardProps<CoursePuzzle, RageState>) {
  return <RageBoard {...props} spec={SPEC} />;
}
