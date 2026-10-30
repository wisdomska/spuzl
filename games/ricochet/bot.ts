/** A simple scripted player: aims for the middle of the widest safe gap on the wall ahead. Tests and demos. */
import { BTN } from "@/phaser/sim/input";
import { BIRD, STRIP, type RicochetSim } from "@/phaser/sim/ricochet";
import { FP } from "@/phaser/sim/fixed";

export function botButtons(sim: RicochetSim): number {
  const side = sim.vx > 0 ? 1 : 0;
  const wall = sim.walls[side];
  let best = -1,
    bestLen = 0;
  for (let i = 0; i < wall.length;) {
    if (wall[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < wall.length && !wall[j]) j++;
    if (j - i > bestLen) {
      bestLen = j - i;
      best = i;
    }
    i = j;
  }
  const sh = sim.slotH();
  const target = STRIP * FP + best * sh + (bestLen * sh) / 2;
  const mid = sim.y + BIRD / 2;
  return mid > target + 2 * FP && sim.vy >= 0 ? BTN.JUMP : 0;
}

/** Rolls the greedy policy forward until the next bounce; true when Spuz survives it. */
function survives(sim: RicochetSim, first: number): boolean {
  const c = sim.clone();
  const pts = c.score();
  let prev = 0;
  for (let i = 0; i < 400 && !c.finished; i++) {
    let b = i === 0 ? first : botButtons(c);
    if (b && prev) b = 0;
    c.step(b);
    prev = b;
    if (c.score() > pts) return true;
  }
  return !c.finished;
}

/** Plays until the run ends or `maxFrames`, returning one button mask per frame (taps are one frame). */
export function botFrames(sim: RicochetSim, maxFrames: number, stopAt = Infinity): number[] {
  const out: number[] = [];
  let prev = 0;
  while (!sim.finished && out.length < maxFrames && sim.score() < stopAt) {
    let b = botButtons(sim);
    if (!prev && !survives(sim, b) && survives(sim, b ? 0 : BTN.JUMP)) b = b ? 0 : BTN.JUMP;
    if (b && prev) b = 0;
    sim.step(b);
    out.push(b);
    prev = b;
  }
  return out;
}
