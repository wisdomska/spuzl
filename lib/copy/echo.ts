/** Echo board copy (games/echo/Board.tsx): watch the pads, tap them back in order. */
const steps = (n: number) => `${n} ${n === 1 ? "step" : "steps"}`;

export const echoCopy = {
  /** why the run ended */
  tooSlow: "Too slow.",
  wrongPad: "Wrong pad.",
  fullSequence: "Full sequence.",
  /** the run's end, after the reason */
  slipEnd: (why: string, best: number) => `${why} You repeated ${steps(best)}.`,
  clearEnd: (why: string, best: number) => `${why} ${best} steps.`,
  runOverAnnounce: (best: number) => `Run over. Longest sequence ${best}.`,
  /** playback */
  watch: (round: number, n: number) => `Watch. Round ${round}, ${steps(n)}.`,
  watchAnnounce: (round: number, n: number) => `Round ${round}. Watch ${n} steps.`,
  /** input */
  yourTurn: (k: number, n: number) => `Your turn, ${k} of ${n}`,
  yourTurnAnnounce: (n: number) => `Your turn. Repeat ${n} steps.`,
  tapAnnounce: (pad: string, k: number, n: number) => `${pad}, ${k} of ${n}`,
  roundDone: (n: number) => `${steps(n)}. One more next round.`,
  /** the first line */
  introTutorial: "Watch the pads light up, then tap them back in order.",
  intro: "Press Start, then watch the pads.",
  /** the Start tool through the run */
  tool: { over: "Run over", watch: "Watch", input: "Your turn", resume: "Resume", start: "Start" },
  /** the status under the pads */
  status: { watch: "Watch", best: (n: number) => `Best ${n}`, paused: "Paused", ready: "Ready" },
  /** screen readers */
  sequence: (len: number, round: number) => `Sequence of ${len}, round ${round}`,
  pads: "Echo pads",
  pad: (shape: string, lit: boolean) => `${shape} pad${lit ? ", lit" : ""}`,
} as const;
