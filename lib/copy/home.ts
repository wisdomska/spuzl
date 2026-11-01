/** Home copy (SPZ-16). */
export const homeCopy = {
  continueGame: (name: string) => `Continue: ${name}`,
  playGame: (name: string) => `Play ${name}`,
  where: (world: string, pos: number, of: number) => `${world} · ${pos} of ${of}`,
  today: (n: number, of: number) => `Today ${n} of ${of}`,
  todayAria: (n: number, of: number) => `Today's Dailies: ${n} of ${of} cleared`,
  allDone: "Full Spuzl. Free play?",
  allDoneSub: "Every Daily cleared today",
  duel: "Duel",
  party: "Party",
  allGames: "All games",
  sleepy: (n: number) => `Your ${n}-day streak is sleepy. One clear wakes it up.`,
  resetsIn: (t: string) => `Resets in ${t}`,
} as const;
