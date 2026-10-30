"use client";

import type { BoardProps } from "@/games/types";
import { RageBoard, type RageGameSpec } from "@/phaser/RageBoard";
import { createRicochetPainter } from "@/phaser/render/ricochet";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { RicochetSim } from "@/phaser/sim/ricochet";
import { createSim } from "./logic";

/** Ricochet board: tap anywhere or BOUNCE to flap; the score sits behind the arena. */
const SPEC: RageGameSpec<RicochetSim> = {
  name: "Ricochet",
  createSim,
  painter: createRicochetPainter,
  controls: "tap",
  action: "Flap",
  hud: "score",
  tall: true,
  startHint: "Tap or press Space to flap",
  levelName: (sim) => sim.a.name,
  finishCopy: (sim) => `Run over. ${sim.points} ${sim.points === 1 ? "bounce" : "bounces"}.`,
  demoLog: async (p) => {
    const [{ botFrames }, { logFromFrames }] = await Promise.all([import("./bot"), import("@/phaser/sim/input")]);
    return logFromFrames(botFrames(createSim(p), 60 * 60 * 3));
  },
};

export default function RicochetBoard(props: BoardProps<CoursePuzzle, RageState>) {
  return <RageBoard {...props} spec={SPEC} />;
}
