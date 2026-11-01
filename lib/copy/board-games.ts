/**
 * Player-facing copy for Board Bay (chess, draughts, oware, ludo, four up, flip). See lib/copy/index.ts
 * for the voice: short, warm, plain.
 */
const LEVEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

export const boardGames = {
  bot: {
    /** entry under the game card (World view, Play anytime) */
    entry: "Play a full game vs bot",
    entryShort: "Play vs bot",
    entryAria: (game: string) => `${game}: play a full game against the bot`,
    levels: LEVEL,
    levelGroup: "Bot level",
    levelLocked: "Restart to change the level.",
    /** title row label in the game header */
    label: (level: keyof typeof LEVEL) => `Vs bot · ${LEVEL[level]}`,
    casual: "Casual game. No XP, nothing ranked.",
    you: "You",
    bot: "Bot",
    yourMove: "Your move.",
    yourRoll: "Your turn. Roll the die.",
    thinking: "The bot is thinking…",
    botMoved: "The bot moved. Your move.",
    botAgain: "The bot goes again.",
    youAgain: "You go again.",
    noMove: (roll: number) => `You rolled ${roll}. No piece can move.`,
    youRolled: (roll: number) => `You rolled ${roll}. Pick a piece.`,
    botRolled: (roll: number) => `The bot rolled ${roll}.`,
    passed: "No move for you, so the bot plays on.",
    won: "You won! Nice game.",
    lost: "The bot won this one.",
    draw: "A draw.",
    over: (reason: string) => `Game over: ${reason}.`,
    undo: "Undo",
    restart: "Restart",
    playAgain: "Play again",
    tryLevel: (level: keyof typeof LEVEL) => `Try ${LEVEL[level]}`,
    back: "Back to Board Bay",
    score: (you: number, bot: number) => `You ${you}, bot ${bot}`,
    loading: "Setting up the board…",
    /** rule line under the title, in place of the puzzle rule */
    rules: {
      fourup: "Drop discs in turn. Four in a line, any direction, wins. You go first with the stars.",
      draughts: "Move diagonally, jump to capture. Captures are compulsory. You play the light pieces.",
      oware: "Sow seeds anticlockwise. Capture 2s and 3s on the bot's side. 25 seeds wins.",
      flip: "Place a disc to outflank and flip the bot's discs. Most discs at the end wins.",
      chess: "Checkmate the bot's king. You play white.",
      ludo: "Roll, move and race all four pieces home before the bot. Land on its pieces to send them back.",
    },
  },
} as const;
