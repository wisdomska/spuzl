/**
 * Server validation of live progress (Handoff rule: progress = correct placements / total, server
 * validated). Clients send their board state; the server computes progress with the game logic's
 * own progress(), never trusting a number from the client.
 */
import type { GameLogic } from "@/games/types";

export const MAX_STATE_BYTES = 64 * 1024;

export interface ProgressInput {
  state: unknown;
  /** mistakes the board has counted so far this round */
  mistakes: number;
}

export interface ProgressVerdict {
  ok: boolean;
  /** 0..1, rounded to 3 places; never 1 unless verify() accepts the state */
  progress: number;
  mistakes: number;
  reason?: string;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Computes the progress for a submitted state. A state that does not solve the puzzle is capped at
 * 0.99 so a strip never shows 100% before the server has verified the clear. Mistakes may only
 * grow, and by at most 10 per update (a board can't make more between two 500 ms updates).
 */
export function validateProgress<P, S, St>(
  logic: Pick<GameLogic<P, S, St>, "progress" | "verify">,
  puzzle: P,
  solution: S,
  input: ProgressInput,
  prevMistakes = 0,
): ProgressVerdict {
  let size = 0;
  try {
    size = JSON.stringify(input.state ?? null).length;
  } catch {
    return { ok: false, progress: 0, mistakes: prevMistakes, reason: "unserialisable state" };
  }
  if (size > MAX_STATE_BYTES) return { ok: false, progress: 0, mistakes: prevMistakes, reason: "state too large" };
  if (!Number.isInteger(input.mistakes) || input.mistakes < 0)
    return { ok: false, progress: 0, mistakes: prevMistakes, reason: "bad mistakes" };
  const mistakes = Math.max(prevMistakes, Math.min(input.mistakes, prevMistakes + 10));
  let p: number;
  try {
    p = logic.progress(puzzle, solution, input.state as St);
  } catch {
    return { ok: false, progress: 0, mistakes, reason: "malformed state" };
  }
  if (!Number.isFinite(p)) return { ok: false, progress: 0, mistakes, reason: "non-finite progress" };
  p = Math.max(0, Math.min(1, p));
  if (p >= 1) {
    let solved = false;
    try {
      solved = logic.verify(puzzle, solution, input.state as St).ok;
    } catch {
      solved = false;
    }
    if (!solved) p = 0.99;
  }
  return { ok: true, progress: round3(p), mistakes };
}

/** Throttle: at most one call per `ms`, keeping the latest arguments for a trailing call. */
export function throttle<A extends unknown[]>(fn: (...a: A) => void, ms: number, now: () => number = Date.now) {
  let last = -Infinity;
  let pending: A | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    timer = null;
    if (!pending) return;
    last = now();
    const a = pending;
    pending = null;
    fn(...a);
  };
  const call = (...a: A) => {
    pending = a;
    const wait = last + ms - now();
    if (wait <= 0 && !timer) fire();
    else if (!timer) timer = setTimeout(fire, Math.max(0, wait));
  };
  call.flush = () => {
    if (timer) clearTimeout(timer);
    fire();
  };
  call.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return call;
}
