/** The game shell's "⋯" menu and its slim top bar (everything that is not needed while playing). */
export const gameMenuCopy = {
  trigger: "Game menu",
  /** the side panel next to the board on a wide screen */
  panel: "Game panel",
  paused: "Paused while this menu is open.",
  livePaused: "Live match: the clock keeps running.",
  howToPlay: "How to play",
  /** the header timer before the first move (R2-15) */
  timerWaits: "Timer starts on your first move",
  /** read before the rule line at the top of the menu (R2-06) */
  rule: "The rule",
  restart: "Restart",
  /** the menu's Restart (or Reset) once the board has moves on it (components/game/RestartConfirm.tsx) */
  restartConfirm: {
    title: "Start this puzzle over?",
    body: "Your moves are cleared. Undo can't bring them back.",
    keep: "Keep playing",
    restart: "Start over",
  },
  newPuzzle: "New puzzle",
  difficulty: "Difficulty",
  levels: { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert", mega: "Mega" } as Record<string, string>,
  sound: "Sound",
  haptics: "Haptics",
  settings: "Settings",
  share: "Share",
  report: "Report a problem",
  on: "On",
  off: "Off",
  shareTitle: (game: string) => `${game} on SPUZL`,
  shareText: (game: string) => `Play ${game} with me on SPUZL`,
  linkCopied: "Link copied.",
  reportSubject: (game: string, label: string) => `Problem with ${game} (${label})`,
  hint: (label: string, left: string) => `${label}. ${left}`,
} as const;
