/** Guided first play copy. */
export const guidedCopy = {
  title: (game: string) => `First time playing ${game}?`,
  body: "A quick practice round. Free hints, nothing counts.",
  /** the one-line banner's note after the title */
  short: "Tap to see how to win.",
  /** the banner opens the game's idea (owner, 14 Nov 2026) */
  aboutAria: (game: string) => `How to win at ${game}`,
  win: {
    time: "Solve it to win. Faster is better; slips only lower your accuracy.",
    score: "Score as many points as you can before it ends.",
    deaths: "Reach the end. Fewer falls is better, then faster.",
  },
  practiceTip: "This round is practice: hints are free and nothing counts.",
  hintTip: "Stuck? Tap Hint. It also pops up on its own if you pause.",
  skip: "Skip",
  skipAria: (game: string) => `Skip the ${game} practice round`,
  doneTitle: "You've got it!",
  doneBody: "That's it. Now for real.",
  goDaily: "Play today's Daily",
  goFree: "Start playing",
  label: "Practice round",
  ruleHint: "Start anywhere.",
  loading: "Setting up a practice board…",
} as const;
