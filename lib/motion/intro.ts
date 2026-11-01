/**
 * Logo intro timeline (Art Direction 01), shared by the page and its sound cues so motion and sound
 * are derived from the same numbers and land on the same frame. Times are seconds from mount.
 *
 *   0.08 to 0.65  S P U L fall (gravity ease-in), squash on contact, rebound, settle. Soft tap per letter.
 *   0.62 to 1.22  Z appears right, pulls back (anticipation), slams left into its notch accelerating,
 *                 overshoots with a squash, settles. Rising air from launch to impact, panned right → centre;
 *                 at impact a deep thump + medium haptic, the notch dot pops and the wordmark dips 3 px.
 *   1.16          Spuz pops out with a bouncy spring (light pop) and waves.
 *   1.72          Tagline fades up 8 px.
 *   2.60          Hand-off to /welcome.
 */
import type { PaletteEvent, PlayOptions } from "@/lib/audio";

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
/** easeInCubic (easings.net): gravity and a slam that accelerates into contact. Physical, not UI. */
export const EASE_IN_CUBIC = [0.32, 0, 0.67, 0] as const;

export const LETTERS = {
  start: 0.08,
  stagger: 0.07,
  duration: 0.44,
  /** fraction of the letter's duration at which it touches the baseline */
  contact: 0.62,
  /** S, P, U, L slot positions → stereo positions (the Z sits between U and L) */
  pan: [-0.35, -0.18, -0.02, 0.3],
} as const;

export const Z = {
  start: 0.62,
  duration: 0.6,
  /** keyframe times: appear, anticipation peak, impact, overshoot, settle */
  times: [0, 0.18, 0.68, 0.8, 1],
} as const;

export const SPUZ_AT = 1.16;
export const TAGLINE_AT = 1.72;
export const FINISH_AT = 2.6;

export const letterContact = (i: number) => LETTERS.start + i * LETTERS.stagger + LETTERS.duration * LETTERS.contact;
export const zLaunch = Z.start + Z.duration * Z.times[1];
export const zImpact = Z.start + Z.duration * Z.times[2];

export interface Cue {
  at: number;
  event: PaletteEvent;
  opts?: PlayOptions;
}

/** Every sound in the intro, in time order. Reduced motion gets a single soft thump as the logo appears. */
export function introCues(reduce: boolean): Cue[] {
  if (reduce) return [{ at: 0.15, event: "introThump", opts: { gain: 0.6 } }];
  const letters: Cue[] = [0, 1, 2, 3].map((i) => ({
    at: letterContact(i),
    event: "letterLand",
    opts: { step: i, pan: LETTERS.pan[i], gain: 0.85 },
  }));
  const rest: Cue[] = [
    { at: zLaunch, event: "introSwoosh", opts: { duration: zImpact - zLaunch, pan: 0.6, panTo: 0 } },
    { at: zImpact, event: "introThump" },
    { at: SPUZ_AT + 0.03, event: "spuzPop" },
  ];
  return [...letters, ...rest].sort((a, b) => a.at - b.at);
}
