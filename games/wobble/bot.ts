/** A scripted balancer (lean plus damping): tests and demo runs. */
import { BTN } from "@/phaser/sim/input";
import type { WobbleSim } from "@/phaser/sim/wobble";

export function botButtons(sim: WobbleSim): number {
  const u = sim.lean + sim.spin * 6;
  return u > 20 ? BTN.LEFT : u < -20 ? BTN.RIGHT : 0;
}

export function botFrames(sim: WobbleSim, maxFrames = 60 * 60 * 10): number[] {
  const out: number[] = [];
  while (!sim.finished && out.length < maxFrames) {
    const b = botButtons(sim);
    sim.step(b);
    out.push(b);
  }
  return out;
}
