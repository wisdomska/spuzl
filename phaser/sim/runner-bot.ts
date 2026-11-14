/**
 * Search bot for the endless runner (phaser/sim/runner.ts): depth-first over coarse decisions (run, jump, duck,
 * each held for `step` frames) with a memo of dead states, so it either finds a crash-free input script to the
 * goal or proves there is none at that granularity. Used by the fairness tests (every generated run is passable)
 * and the dev autoplay. Coarser steps are closer to what a person can do: the tests use 4 frames (67 ms).
 */
import { BTN } from "./input";
import type { RunnerSim } from "./runner";

const ACTIONS = [0, BTN.JUMP, BTN.DOWN] as const;

interface Node {
  s: RunnerSim;
  /** next action index to try */
  i: number;
  /** buttons held to get here, and for how many frames */
  a: number;
  n: number;
}

const key = (s: RunnerSim, a: number) =>
  `${s.frame}|${s.y}|${s.vy}|${+s.onGround}|${+s.ducking}|${Math.min(s.air, 99)}|${s.buf}|${+s.fast}|${a & BTN.JUMP}`;

/**
 * Buttons per frame that take `start` to `goal` metres (or to its finish line) without a crash, or null when no
 * script at this granularity exists (or the search runs past `maxNodes`).
 */
export function solveRun(start: RunnerSim, goal: number, step = 4, maxNodes = 400_000): number[] | null {
  const reached = (s: RunnerSim) => (s.finished && s.deaths === start.deaths) || s.metres() >= goal;
  const dead = new Set<string>();
  const stack: Node[] = [{ s: start.clone(), i: 0, a: 0, n: 0 }];
  let nodes = 0;
  while (stack.length) {
    const top = stack[stack.length - 1];
    if (reached(top.s)) {
      const out: number[] = [];
      for (const nd of stack) for (let k = 0; k < nd.n; k++) out.push(nd.a);
      return out;
    }
    if (top.i >= ACTIONS.length) {
      dead.add(key(top.s, top.a));
      stack.pop();
      continue;
    }
    const a = ACTIONS[top.i++];
    const s = top.s.clone();
    let n = 0;
    let crashed = false;
    for (; n < step; n++) {
      s.step(a);
      if (s.deaths > start.deaths) {
        crashed = true;
        break;
      }
      if (reached(s)) {
        n++;
        break;
      }
    }
    if (crashed || dead.has(key(s, a))) continue;
    if (++nodes > maxNodes) return null;
    stack.push({ s, i: 0, a, n });
  }
  return null;
}
