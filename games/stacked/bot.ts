/** A scripted stacker for tests and demos: drops when the block lines up, `miss` px off every few blocks. */
import { BTN } from "@/phaser/sim/input";
import { FP } from "@/phaser/sim/fixed";
import type { StackedSim } from "@/phaser/sim/stacked";

export function botFrames(sim: StackedSim, maxFrames: number, stopAt = Infinity, miss = 0): number[] {
  const out: number[] = [];
  let prev = 0;
  while (!sim.finished && out.length < maxFrames && sim.score() < stopAt) {
    const top = sim.tower[sim.tower.length - 1];
    const n = sim.tower.length;
    const aim = top.x + (miss && n % 4 === 0 ? (n % 8 ? miss : -miss) * FP : 0);
    let b = Math.abs(sim.x - aim) <= Math.abs(sim.v) / 2 ? BTN.JUMP : 0;
    if (b && prev) b = 0;
    sim.step(b);
    out.push(b);
    prev = b;
  }
  return out;
}
