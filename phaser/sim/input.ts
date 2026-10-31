/**
 * Input logs: the only thing an action game submits. `events` holds [frame, buttons] pairs whenever the
 * held buttons change; `frames` is the total number of simulated steps.
 */
import type { InputLog } from "@/games/types";
import { STEP_MS } from "./fixed";

export const BTN = { LEFT: 1, RIGHT: 2, JUMP: 4, DOWN: 8 } as const;
export const BTN_MASK = 15;

/** Longest accepted run: 45 minutes of play. */
export const MAX_FRAMES = 60 * 60 * 45;

/** Records one button bitmask per simulated frame. */
export class LogRecorder {
  events: [number, number][] = [];
  frames = 0;
  private last = 0;

  push(buttons: number) {
    const b = buttons & BTN_MASK;
    if (b !== this.last || (this.frames === 0 && b !== 0)) {
      this.events.push([this.frames, b]);
      this.last = b;
    }
    this.frames++;
  }

  toLog(): InputLog {
    return { step: STEP_MS, events: this.events.map((e) => [e[0], e[1]] as [number, number]), frames: this.frames };
  }

  static from(log: InputLog): LogRecorder {
    const r = new LogRecorder();
    r.events = log.events.map((e) => [e[0], e[1]] as [number, number]);
    r.frames = log.frames;
    r.last = log.events.length ? log.events[log.events.length - 1][1] : 0;
    return r;
  }
}

/** Sequential reader: call `at(frame)` with frames 0, 1, 2, ... in order. */
export function readerFor(log: InputLog): (frame: number) => number {
  let i = 0;
  let cur = 0;
  return (frame: number) => {
    while (i < log.events.length && log.events[i][0] <= frame) {
      cur = log.events[i][1];
      i++;
    }
    return cur;
  };
}

/** Returns a reason when the log is malformed, or null when it is well formed. */
export function validateLog(log: unknown, maxFrames = MAX_FRAMES): string | null {
  if (!log || typeof log !== "object") return "log missing";
  const l = log as Partial<InputLog>;
  if (typeof l.step !== "number" || Math.abs(l.step - STEP_MS) > 1e-6) return "bad step";
  if (!Number.isInteger(l.frames) || (l.frames as number) < 1 || (l.frames as number) > maxFrames) return "bad frame count";
  if (!Array.isArray(l.events) || l.events.length > (l.frames as number) + 1) return "bad events";
  let prev = -1;
  for (const e of l.events) {
    if (!Array.isArray(e) || e.length !== 2) return "bad event";
    const [f, b] = e;
    if (!Number.isInteger(f) || !Number.isInteger(b)) return "bad event";
    if (f <= prev || f < 0 || f >= (l.frames as number)) return "events out of order";
    if (b < 0 || b > BTN_MASK) return "bad buttons";
    prev = f;
  }
  return null;
}

/** Builds a log from a per-frame button array (tests and scripted solutions). */
export function logFromFrames(frames: ArrayLike<number>): InputLog {
  const r = new LogRecorder();
  for (let i = 0; i < frames.length; i++) r.push(frames[i]);
  return r.toLog();
}

/** Expands a log into one bitmask per frame. */
export function framesFromLog(log: InputLog): number[] {
  const at = readerFor(log);
  const out: number[] = [];
  for (let f = 0; f < log.frames; f++) out.push(at(f));
  return out;
}

/** Compact run-length script: [[buttons, frames], ...] → InputLog. */
export function logFromScript(script: readonly (readonly [number, number])[]): InputLog {
  const out: number[] = [];
  for (const [b, n] of script) for (let i = 0; i < n; i++) out.push(b);
  return logFromFrames(out);
}

/** InputLog → run-length script (used to store scripted solutions compactly). */
export function scriptFromLog(log: InputLog): [number, number][] {
  const frames = framesFromLog(log);
  const out: [number, number][] = [];
  for (const b of frames) {
    const last = out[out.length - 1];
    if (last && last[0] === b) last[1]++;
    else out.push([b, 1]);
  }
  return out;
}
