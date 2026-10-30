/** Builds whole-course logs from per-level scripted solutions (tests, ghosts and demo runs). */
import type { InputLog } from "@/games/types";
import { logFromFrames } from "./input";

/** Concatenates level scripts with `pause` idle frames between levels (the course's level pause). */
export function courseLog(levelIds: string[], solutions: Record<string, readonly (readonly number[])[]>, pause: number): InputLog {
  const frames: number[] = [];
  levelIds.forEach((id, i) => {
    const s = solutions[id];
    if (!s) throw new Error(`no scripted solution for ${id}`);
    if (i > 0) for (let k = 0; k < pause; k++) frames.push(0);
    for (const [b, n] of s) for (let k = 0; k < n; k++) frames.push(b);
  });
  return logFromFrames(frames);
}
