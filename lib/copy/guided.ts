/** Guided first play copy. */
export const guidedCopy = {
  title: (game: string) => `First time playing ${game}?`,
  body: "A quick practice round. Hints are free and pop up when you pause. Nothing counts yet.",
  skip: "Skip",
  skipAria: (game: string) => `Skip the ${game} practice round`,
  doneTitle: "You've got it!",
  doneBody: "That's the whole idea. Now for real.",
  goDaily: "Play today's Daily",
  goFree: "Start playing",
  label: "Practice round",
  ruleHint: "Start anywhere.",
  loading: "Setting up a practice board…",
} as const;
