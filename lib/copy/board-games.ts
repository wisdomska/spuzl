/**
 * Player-facing copy for Board Bay (chess, draughts, oware, ludo, four up; flip only for games already running). See lib/copy/index.ts
 * for the voice: short, warm, plain.
 */
import { dara } from "./dara";

const LEVEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

export const boardGames = {
  /** Live chess board (Board Bay and vs bot) */
  chess: {
    promoteGroup: "Promote to",
    choosePromotion: "Choose a promotion piece.",
    promoteTo: (piece: string) => `Promote to ${piece}`,
    promoted: (piece: string) => `Promoted to ${piece}.`,
    promotionCancelled: "Promotion cancelled.",
    /** Escape on the board, or a tap off the piece */
    putDown: "Piece put down.",
    lastMove: "last move",
  },
  /** Live draughts board: why a tap on your own man did nothing, and the last move's squares */
  draughts: {
    mustCapture: "Captures are compulsory. Take with an outlined piece.",
    blocked: "That piece is blocked. Outlined pieces can move.",
    lastMove: "last move",
    putDown: "Piece put down.",
    /** two capture routes end on the same square */
    chooseRoute: "Two ways to take there. Tap the next square to pick your route.",
    nextHop: "next square on a route",
  },
  /** Live Oware board: why a tap on your own pit did nothing, and the pit sown last */
  oware: {
    empty: "That pit is empty. Pick one with seeds.",
    feed: "Their side is empty, so you must sow seeds across to them. Outlined pits do that.",
    lastSown: "sown last",
  },
  /** Live Four Up board: the disc dropped last */
  fourup: {
    lastDisc: "dropped last",
  },
  /** Board Bay match screen (friends, Play live, the Practice bot) */
  match: {
    /** one tap on Resign used to end the game at once: it asks first */
    resignAsk: (winner: string) => `Resign this game? ${winner} wins.`,
    resignAskBot: "Resign this game? Spuzl wins.",
    resign: "Resign",
    /** the Practice bot takes every draw offer, so a draw ends the game: it asks first */
    drawAskBot: "Offer a draw? Spuzl always takes it, so the game ends here.",
    draw: "Draw",
    keep: "Keep playing",
    /** the move is on its way and the Practice bot answers in the same trip */
    thinking: "Thinking…",
    /** under each name: whose move it is (async games have no clock to say it) */
    yourMove: "Your move",
    theirMove: "Their move",
    waiting: "Waiting",
    /** your draw offer to a person, while they decide */
    drawPending: (name: string) => `Draw offered. Waiting for ${name}.`,
    withdraw: "Withdraw",
    drawWithdrawn: "Draw offer withdrawn.",
    /** Takeback before you have moved */
    noTakeback: "No move of yours to take back yet.",
  },
  bot: {
    /** entry under the game card (World view, Play anytime) */
    entry: "Play a full game vs Spuzl",
    entryShort: "Play vs Spuzl",
    entryAria: (game: string) => `${game}: play a full game against Spuzl`,
    levels: LEVEL,
    /** title row label in the game header */
    label: (level: keyof typeof LEVEL) => `Vs Spuzl · ${LEVEL[level]}`,
    casual: "Casual game. No XP, nothing ranked.",
    you: "You",
    bot: "Spuzl",
    yourMove: "Your move.",
    yourRoll: "Your turn. Roll the die.",
    thinking: "Spuzl is thinking…",
    botMoved: "Spuzl moved. Your move.",
    botAgain: "Spuzl goes again.",
    youAgain: "You go again.",
    noMove: (roll: number) => `You rolled ${roll}. No piece can move.`,
    youRolled: (roll: number) => `You rolled ${roll}. Pick a piece.`,
    botRolled: (roll: number) => `Spuzl rolled ${roll}.`,
    passed: "No move for you, so Spuzl plays on.",
    won: "You won! Nice game.",
    lost: "Spuzl won this one.",
    draw: "A draw.",
    over: (reason: string) => `Game over: ${reason}.`,
    undo: "Undo",
    restart: "Restart",
    /** Restart mid-game asks first */
    restartAsk: "Start a new game? This one ends here.",
    keep: "Keep playing",
    playAgain: "Play again",
    tryLevel: (level: keyof typeof LEVEL) => `Try ${LEVEL[level]}`,
    back: "Back to Board Bay",
    score: (you: number, bot: number) => `You ${you}, Spuzl ${bot}`,
    loading: "Setting up the board…",
    /** Help sheet tips for a game vs the bot (in place of the solo puzzle tips: no hints or XP here) */
    help: {
      casual: "A casual game against the computer. No XP, nothing ranked.",
      level: "Pick Easy, Medium or Hard in the ⋯ menu. A new level starts a new game.",
      undo: "Undo takes back your last move.",
    },
    /** rule line under the title, in place of the puzzle rule */
    rules: {
      fourup: "Drop discs in turn. Four in a line, any direction, wins. You go first with the stars.",
      draughts: "Move diagonally, jump to capture. Captures are compulsory. You play the light pieces.",
      oware: "Sow seeds anticlockwise. Capture 2s and 3s on Spuzl's side. 25 seeds wins.",
      flip: "Place a disc to outflank and flip Spuzl's discs. Most discs at the end wins.",
      chess: "Checkmate Spuzl's king. You play white.",
      ludo: "Roll, move and race all four pieces home before Spuzl. Land on its pieces to send them back.",
      dara: dara.botRule,
    },
  },
} as const;
