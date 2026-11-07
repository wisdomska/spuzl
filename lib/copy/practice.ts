/** R2-07: practice rounds around live games (Duel, Party). */
export const practiceCopy = {
  /** before a live round: the offer while waiting in a Party room or for a friend's Duel */
  firstTitle: (game: string) => `New to ${game}?`,
  firstBody: "Try a quick practice round while you wait. Free hints, nothing counts.",
  firstCta: "Practice first",
  firstAria: (game: string) => `Practice ${game} first`,
  /** the practice round opened from a room: its last button goes back there */
  backToRoom: "Back to the room",
  dialog: (game: string) => `${game} practice round`,
  /** when the round is already starting: a 10-second card instead */
  howTitle: (game: string) => `How it works: ${game}`,
  howBody: "Your first time with this one. The race is on, so read this and go.",
  howGot: "Got it",
  howAuto: "Closes by itself in 10 seconds",
  howAria: (game: string) => `How ${game} works`,
} as const;
