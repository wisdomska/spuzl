/** Player-facing copy for Beat Tap (games/beattap). Short, warm, plain; a bit of highlife swing. */
import type { Mark } from "@/games/beattap/logic";

export const BEATTAP_COPY = {
  tutorial: "Practice round: tap when the ring closes on the circle. Off-beat taps cost nothing here.",
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
  strayPractice: "No beat there. Practice, so no points lost.",
  /** the count-in before scoring starts (R2-10) */
  countIn: (n: number) => `Count in: ${n}`,
  countInSmall: "Count along. Taps start on the beat",
  countInAnnounce: "Count in. One, two, three, four, then tap on each beat.",
  /** first play, sound off or not yet allowed (R2-10) */
  soundAskTitle: "Turn sound on for this one?",
  soundAskBody: "Beat Tap is easier when you can hear the beat. You can still play by the rings.",
  soundAskBodyLocked: "Your phone has not let SPUZL play sound yet. Turn it on and you will hear the count.",
  soundOn: "Turn sound on",
  soundNotNow: "Not now",
  soundOnDone: "Sound on. Listen for the count.",
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
