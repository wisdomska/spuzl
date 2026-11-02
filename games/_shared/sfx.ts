/**
 * Board feedback vocabulary: one call per kind of board action, so every board sounds (and buzzes) the same
 * for the same kind of move. Built on the palette in lib/audio/palette.ts; the haptic follows the voice.
 *
 *   place(streak)  a mark, tile, letter or piece put down: rounded blip climbing with the correct streak (medium)
 *   remove()       erase, take back, clear a cell: the tap at a soft level (light)
 *   select()       pick a cell, piece or card without committing anything yet: tap (light)
 *   trace(step)    one more cell on a dragged path or line: a quiet rising synth note, no haptic per cell
 *   cascade(n)     a run of n notes (word found, group solved): chimes 40 ms apart, rising (medium on the first)
 *   move()         a piece slides or a counter is sown, a board-game move: wooden clack (light)
 *   capture()      a piece taken: capture knock (medium)
 *   miss()         a round lost to the clock or a fizzled try that is not a rule break (warning-free fizzle)
 *
 * Not here on purpose: rule breaks (api.ruleBreak plays the error buzz and warning haptic), hints (the shell
 * plays the hint sparkle) and the clear (the shell plays it once when the board reports onSolved).
 * Tool buttons (Undo, Erase, Hint...) already tap on press from the app-wide listener; boards stay quiet there.
 */
import { play } from "@/lib/audio";

/** Level for removals and take-backs: present but clearly softer than a placement. */
export const SOFT_GAIN = 0.55;
/** Level for drag steps: texture under the finger, never louder than the place at the end. */
export const TRACE_GAIN = 0.7;
/** Spacing of cascade notes (matches the word-fly stagger). */
export const CASCADE_MS = 40;

export const sfx = {
  place(streak = 0) {
    play("place", { step: Math.max(0, streak) });
  },
  remove() {
    play("tap", { gain: SOFT_GAIN });
  },
  select() {
    play("tap");
  },
  trace(step = 0) {
    play("synth", { step: Math.max(0, step), gain: TRACE_GAIN, silentHaptic: true });
  },
  cascade(n: number, from = 0) {
    // Scheduled on the audio clock, so the run stays even even when the main thread is busy.
    for (let k = 0; k < n; k++) play("chime", { step: from + k, delay: (k * CASCADE_MS) / 1000, silentHaptic: k > 0 });
  },
  move() {
    play("clack");
  },
  capture() {
    play("capture");
  },
  miss() {
    play("fizzle");
  },
};
