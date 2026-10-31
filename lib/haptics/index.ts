/**
 * SPUZL haptics. Vibration API patterns from design/spuzl-audio.js and the Handoff motion spec.
 * iOS Safari has no Vibration API: there we dispatch `spuzl:haptic-fallback`, and HapticFallback
 * plays a 2 px micro-shake on the element the player just touched. Haptics always pair with a visual.
 */
import type { SfxName } from "@/lib/audio";

export const HAPTICS: Partial<Record<SfxName, number[]>> = {
  tick: [8],
  pop: [6],
  buzz: [20, 40, 20],
  chime: [10],
  jingle: [30, 10, 30],
  fanfare: [50],
  whoosh: [15],
  swoosh: [10],
  clink: [25],
  cheer: [40],
  splat: [15],
  drum: [20],
  horn: [30],
  bump: [25],
  sting: [20, 30, 20],
  clack: [10],
  capture: [18],
  emote: [8],
  check: [12, 60, 12],
};

/** Named patterns used directly by features (Step 5b list). */
export const PATTERNS = {
  button: [8],
  cell: [6],
  ruleBreak: [20, 40, 20],
  clear: [30, 10, 30],
  levelUp: [50],
  badge: [25],
  countdown: [20],
  overtake: [10],
  streak: [15],
  promotion: [40],
  duelWin: [30, 10, 30, 10, 60, 20, 120],
} as const;

let enabled = true;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

export function supportsVibration() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function haptic(pattern: readonly number[]) {
  if (!enabled || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("spuzl:haptic", { detail: { pattern } }));
  // Before the first tap browsers block vibrate() and log a console error: skip it quietly.
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return;
  try {
    if (supportsVibration()) navigator.vibrate([...pattern]);
    else window.dispatchEvent(new CustomEvent("spuzl:haptic-fallback", { detail: { pattern } }));
  } catch {
    /* some browsers throw before a user gesture */
  }
}
