/** Player-facing copy for Beat Tap (games/beattap). Short, warm, plain; a bit of highlife swing. */
import type { Mark } from "@/games/beattap/logic";

export const BEATTAP_COPY = {
  tutorial: "Tap when the ring closes on the circle. Sound helps but is optional.",
  intro: (beats: number) => `${beats} beats. Tap or press Space on each one. Extra taps cost points.`,
  introReduced: (beats: number) => `${beats} beats. Tap or press Space when the ring is full. Extra taps cost points.`,
  start: "Start the beat",
  tap: "Tap",
  done: "Done",
  getReady: "Get ready",
  getReadySmall: "First beat soon",
  onBeat: "Tap on the beat",
  onFull: "Tap when the ring is full",
  mark: { perfect: "Perfect", good: "Good", miss: "Miss" } satisfies Record<Mark, string>,
  stray: "Off beat",
  strayFeedback: (penalty: number) => `No beat there. Minus ${penalty}.`,
  missFeedback: "Missed one. Catch the next beat.",
  beatOf: (beat: number, total: number) => `Beat ${beat} of ${total}`,
  padLabel: (status: string) => `Beat pad. ${status}`,
  songProgress: "Song progress",
  tallyLabel: "Judgements",
  tally: (label: string, n: number) => `${label}: ${n}`,
  startAnnounce: "Beat started. Tap on each beat.",
  finished: (score: number, perfect: number, total: number) =>
    perfect === total ? `Ayekoo! Every beat perfect. Score ${score}.` : `Song done. ${perfect} perfect of ${total}. Score ${score}.`,
  score: "Score",
  restart: "Paused. The song starts again from the top.",
};
