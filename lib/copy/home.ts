/** Home copy (SPZ-16). */
export const homeCopy = {
  continueGame: (name: string) => `Continue: ${name}`,
  playGame: (name: string) => `Play ${name}`,
  where: (world: string, pos: number, of: number) => `${world} · ${pos} of ${of}`,
  today: (n: number, of: number) => `Today ${n} of ${of}`,
  todayAria: (n: number, of: number) => `Today's Dailies: ${n} of ${of} cleared`,
  allDone: "Full Spuzl. Free play?",
  allTried: "Pick any game",
  islandsToday: "Dailies cleared today",
  islandsTried: "games tried",
  allTriedSub: "You've tried them all. Play your favourites.",
  triedAria: (n: number, of: number) => `Games tried: ${n} of ${of}`,
  allDoneSub: "Every Daily cleared today",
  duel: "Duel",
  party: "Party",
  allGames: "All games",
  sleepy: (n: number) => `Your ${n}-day streak is sleepy. One clear wakes it up.`,
  sleepyFive: (n: number) => `Your ${n}-day streak is sleepy. One Daily Five game wakes it up.`,
  resetsIn: (t: string) => `Resets in ${t}`,
  /** R2-18: the Continue card's line for a game with levels ("Level 12 · Puzzles") */
  levelWhere: (level: number, world: string) => `Level ${level} · ${world}`,
  /** R2-18: Home's new-games card, opening All games filtered to New */
  newGames: (n: number) => (n === 1 ? "1 new game to try" : `${n} new games to try`),
  newGamesSee: "See them",
  newGamesDismiss: "Hide new games",
} as const;
