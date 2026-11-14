"use client";

import { useMemo } from "react";
import type { BoardProps } from "@/games/types";
import { RageBoard, type GhostSpec, type RageGameSpec } from "@/phaser/RageBoard";
import { createRunnerPainter } from "@/phaser/render/runner";
import type { CoursePuzzle, RageState } from "@/phaser/sim/course";
import type { RunnerSim } from "@/phaser/sim/runner";
import { createSim, freshState, runName } from "./logic";

/**
 * Dash board: endless runner. Tap the upper canvas, JUMP, Space or Up to jump (hold for higher); the lower canvas,
 * DUCK, Down or S to duck (and to drop fast in the air). The painter draws the HUD; Ghost Race ready.
 */
function makeSpec(p: CoursePuzzle): RageGameSpec<RunnerSim> {
  const name = runName(p);
  const endless = !p.levels?.[0]?.startsWith("lvl-");
  return {
    name: "Dash",
    createSim,
    painter: () => createRunnerPainter({ bestKey: endless ? `spuzl.dash.best.${p.levels?.[0] ?? "run"}` : undefined }),
    controls: "runner",
    hud: "runner",
    startHint: "Tap to jump · swipe down to duck",
    deathNoun: "Crash",
    deathLines: ["Back to the start line.", "Same run, you know it now.", "Jump earlier, duck sooner.", "Spuz is ready. Go."],
    levelName: () => name,
    metres: (sim) => sim.metres(),
    finishCopy: (sim) =>
      sim.def.target !== undefined
        ? `Level cleared: ${sim.metres()} m with ${sim.deaths} ${sim.deaths === 1 ? "crash" : "crashes"}.`
        : sim.deaths
          ? `Run over at ${sim.metres()} m.`
          : `Time's up at ${sim.metres()} m.`,
    demoLog: async (pz) => {
      const [{ solveRun }, { logFromFrames }] = await Promise.all([import("@/phaser/sim/runner-bot"), import("@/phaser/sim/input")]);
      const sim = createSim(pz);
      const frames = solveRun(sim, sim.def.target ?? 600, 4) ?? [0];
      return logFromFrames(frames);
    },
  };
}

export default function DashBoard(props: BoardProps<CoursePuzzle, RageState> & { ghost?: GhostSpec | null }) {
  // the puzzle is fixed for the life of the board (the shell remounts on a new puzzle)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const spec = useMemo(() => makeSpec(props.puzzle), []);
  return <RageBoard {...props} initialState={freshState(props.initialState)} spec={spec} />;
}
