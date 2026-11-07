/** The game shell's Pause sheet and the cover that hides the board while the game is held (R2-16). */
export const pauseCopy = {
  title: "Paused",
  /** under the title: true in every state, the board is always covered while paused */
  hidden: "Board hidden. No peeking, Spuzler.",
  /** on the cover over the board (Pause, the menu, How to play, a confirm) */
  cover: "Board hidden",
  resume: "Resume",
  howTo: "How to play",
  howToValue: "20 s",
  quit: "Quit puzzle",
  quitValue: "Progress saved",
} as const;
