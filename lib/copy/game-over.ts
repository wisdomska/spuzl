/** The end-of-game card for full games (Board Games matches, games against the bot). */
export const gameOverCopy = {
  won: "You won!",
  lost: "You lost",
  draw: "It's a draw",
  seeBoard: "See the board",
  rematch: "Rematch",
  playAgain: "Play again",
  reason: {
    checkmate: "Checkmate.",
    resign: "They resigned.",
    youResigned: "You resigned.",
    flag: "Their clock ran out.",
    yourFlag: "Your clock ran out.",
    timeout: "They ran out of time to move.",
    yourTimeout: "You ran out of time to move.",
    agreed: "Draw agreed.",
    stalemate: "Stalemate.",
  },
} as const;
