/** Board Bay "Play live" (matchmaking for live board games) and its entry points. */
export const bayLive = {
  /** entries under a board game's card (World view, Library sheet, game over vs the bot) */
  playLive: "Play live",
  playLiveAria: (game: string) => `${game}: play live against another player`,
  challengeFriend: "Challenge a friend",
  challengeFriendAria: (game: string) => `${game}: challenge a friend`,
  /** R4-01: under 16, Play live is a muted note on the game card and world page, never a button */
  liveLocked: "Opens at 16",
  /** Library sheet group heading */
  liveGroup: "Play someone",
  /** the search screen */
  screenLabel: "Board Bay live search",
  chip: (minutes: number) => `Live, ${minutes} min each`,
  chipPick: "Live, rated",
  pickTitle: (game: string) => `Live ${game}`,
  pickHint: "Minutes on each player's clock.",
  findOpponent: (minutes: number) => `Find an opponent, ${minutes} min`,
  title: "Finding an opponent",
  sub: (game: string, minutes: number) => `${game}, rated, ${minutes} minutes each`,
  searching: "searching",
  othersWaiting: (n: number) => (n === 1 ? "1 other waiting" : `${n} others waiting`),
  hint: "Paired with someone near your level.",
  found: "Found someone. Setting up the board…",
  cancel: "Cancel",
  back: "Back",
  /** after a minute with nobody found */
  timeoutTitle: "Nobody's free right now",
  timeoutBody: "Invite a friend or play the bot.",
  inviteFriend: "Invite a friend",
  playBot: "Play the bot",
  searchAgain: "Search again",
  /** errors */
  ageRestricted: "Play live opens at 16. Challenge a friend instead.",
  joinFailed: "Couldn't start the search. Try again.",
  inviteFailed: "Couldn't make an invite. Try again.",
  retired: "This game has left Board Bay.",
  /** Duel entry and Friends: where live board games live */
  duelLink: "Board games, live",
  duelLinkSub: "Chess, draughts and more, live",
} as const;
