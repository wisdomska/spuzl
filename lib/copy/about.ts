/** Public About / landing page (also what signed-out visitors and Google's reviewers see at "/"). */
export const aboutCopy = {
  metaTitle: "SPUZL: 51 puzzle games, duels and leagues",
  metaDescription:
    "SPUZL is a free web app with 51 short puzzle, word, number and board games. Play any time as a guest, duel friends and climb weekly leagues.",
  name: "SPUZL",
  lede: "SPUZL is a free puzzle games app with 51 short games across 9 worlds. Play any time, as often as you like, right in your browser.",
  play: "Play now",
  signIn: "Sign in",
  whatTitle: "What you can do",
  what: [
    ["Play 51 games", "Logic puzzles, word games, number games, reflex games and classic board games like oware, draughts and chess."],
    ["Learn as you go", "Each game starts with a short practice round with free hints. You can skip it."],
    ["Keep a streak", "Clear one game a day to grow your streak and earn XP and Sparks."],
    ["Play with friends", "Duel a friend, host a party room, or join a weekly league of 30 players."],
  ] as const,
  worldsTitle: "The worlds",
  accountTitle: "Accounts and your data",
  account: [
    "You can play as a guest with no account. To keep your progress on any phone, sign in with a 6-digit email code or with Google.",
    "With Google sign-in, SPUZL asks Google only for your name, email address and profile picture. We use your email to sign you in and recover your account. We never post for you, read your contacts or sell your data.",
    "You can download or delete your data any time in Settings.",
  ] as const,
  privacy: "Privacy policy",
  terms: "Terms of use",
  contact: "Contact",
  made: "Made in Ghana for puzzle lovers everywhere.",
} as const;
