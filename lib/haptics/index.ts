/**
 * SPUZL haptics. One small vocabulary of Vibration API patterns, mapped onto the same events as the
 * sound palette. iOS Safari has no Vibration API: there we dispatch `spuzl:haptic-fallback`, and
 * HapticFallback plays a 2 px micro-shake on the element the player just touched. Haptics always pair
 * with a visual, never replace one.
 *
 *   light    taps, toggles, navigation       one 8 ms tick
 *   medium   placements, landings, joins     one 16 ms knock
 *   heavy    impacts (bump, splat)           one 28 ms hit
 *   success  clears, wins, claims            short-gap-long
 *   warning  rule breaks, wrong answers      buzz-gap-buzz
 *   celebrate level up, promotion, big wins  a little drum roll
 */
import type { SfxName } from "@/lib/audio/palette";

export const LEVELS = {
  light: [8],
  medium: [16],
  heavy: [28],
  success: [14, 60, 28],
  warning: [22, 50, 22],
  celebrate: [30, 10, 30, 10, 60],
} as const;

export type HapticLevel = keyof typeof LEVELS;

/** Which level each voice fires. Voices left out (ambient air, music-like stings) stay silent to the hand. */
export const HAPTIC_LEVEL: Partial<Record<SfxName, HapticLevel>> = {
  tick: "light",
  nav: "light",
  toggle: "light",
  emote: "light",
  hop: "light",
  spuzpop: "light",
  clack: "light",
  pop: "medium",
  chime: "medium",
  capture: "medium",
  drum: "medium",
  join: "medium",
  thump: "medium",
  land: "medium",
  count: "light",
  clink: "medium",
  success: "success",
  jingle: "success",
  win: "success",
  cheer: "success",
  streak: "success",
  buzz: "warning",
  sting: "warning",
  check: "warning",
  spike: "warning",
  fanfare: "celebrate",
  horn: "celebrate",
  bump: "heavy",
  splat: "heavy",
  whoosh: "light",
  lose: "medium",
};

/** Pattern per voice, derived from the levels above. */
export const HAPTICS: Partial<Record<SfxName, readonly number[]>> = Object.fromEntries(
  Object.entries(HAPTIC_LEVEL).map(([k, level]) => [k, LEVELS[level as HapticLevel]]),
);

/** Named patterns used directly by features. */
export const PATTERNS = {
  button: LEVELS.light,
  cell: LEVELS.medium,
  ruleBreak: LEVELS.warning,
  clear: LEVELS.success,
  levelUp: LEVELS.celebrate,
  badge: LEVELS.medium,
  countdown: LEVELS.light,
  overtake: LEVELS.light,
  streak: LEVELS.success,
  promotion: LEVELS.celebrate,
  duelWin: [30, 10, 30, 10, 60, 20, 120],
} as const;

let enabled = true;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

export function hapticsOn() {
  return enabled;
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
