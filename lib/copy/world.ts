/** World screen copy. */
export const worldCopy = {
  clearedToday: (n: number, of: number) => `${n} of ${of} cleared today.`,
  tried: (n: number, of: number) => `${n} of ${of} tried.`,
  done: "Done",
  played: "Played",
  isNew: "New",
  resume: "Resume",
  withOthers: (game: string) => `More ways to play ${game}`,
} as const;
