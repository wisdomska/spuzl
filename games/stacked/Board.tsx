"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type RageGameSpec } from "@/phaser/RageBoard";
import { createStackedPainter } from "@/phaser/render/stacked";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { StackedSim } from "@/phaser/sim/stacked";
import { createSim } from "./logic";

/** Stacked board: tap anywhere or DROP; the tower scrolls up as it grows. */
const SPEC: RageGameSpec<StackedSim> = {
  name: "Stacked",
  createSim,
  painter: createStackedPainter,
  controls: "tap",
  action: "Drop",
  hud: "score",
  tall: true,
  startHint: "Tap or press Space to drop",
  levelName: (sim) => sim.t.name,
  finishCopy: (sim) => `Tower done. ${sim.score()} ${sim.score() === 1 ? "block" : "blocks"} high.`,
  demoLog: async (p) => {
    const [{ botFrames }, { logFromFrames }] = await Promise.all([import("./bot"), import("@/phaser/sim/input")]);
    return logFromFrames(botFrames(createSim(p), 60 * 60 * 5, Infinity, 5));
  },
};

export default function StackedBoard(props: BoardProps<CoursePuzzle, RageState>) {
  return <RageBoard {...props} spec={SPEC} />;
}
