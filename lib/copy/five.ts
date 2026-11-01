/** Player-facing copy for Five (Word Woods). Short, warm, plain. */

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export const MARK_SAY = ["not in the word", "in the word, wrong spot", "right spot"] as const;
/** Short tag on a keyboard key, after the letter */
export const KEY_SAY = ["not in the word", "in the word", "right spot"] as const;

export const FIVE_COPY = {
  start: "Guess the 5-letter word. You have 6 tries.",
  startTutorial: "Type any 5-letter word, then press Enter. The tiles tell you how close you are.",
  grid: "Guesses",
  keyboard: "Letter keyboard",
  enter: "ENTER",
  undo: "Clear row",
  hintLabel: "Hint",
  /** spoken name of one tile */
  cellSay: (row: number, col: number, letter: string, mark: string | null, hinted: boolean) =>
    `Row ${row}, column ${col}, ${letter ? letter : "empty"}${mark ? `, ${mark}` : ""}${hinted ? ", hint" : ""}`,
  /** the legend under the grid */
  legendHit: "Right spot",
  legendNear: "In the word",
  legendMiss: "Not in it",
  legend: "Tile key",
  tooShort: "Five letters, please.",
  notWord: (w: string) => `${w} isn't in our word list. That try is still yours.`,
  repeat: (w: string) => `You already tried ${w}.`,
  checking: "Checking…",
  offline: "We couldn't check that word. Check your connection and try again.",
  guessSay: (n: number, word: string, parts: string[]) => `Guess ${n}, ${word}. ${parts.join(". ")}.`,
  triesLeft: (n: number) => `${n} ${plural(n, "try", "tries")} left.`,
  close: (hits: number, left: number) => `${hits} in the right spot. ${left} ${plural(left, "try", "tries")} left.`,
  cold: (left: number) => `No letters in the right spot yet. ${left} ${plural(left, "try", "tries")} left.`,
  solved: (n: number) => (n === 1 ? "Ei! First try. Five out of five." : `Got it in ${n}. Well played.`),
  lost: (answer: string) => `Out of tries. The word was ${answer}.`,
  lostNoAnswer: "Out of tries. Better luck tomorrow.",
  hint: (pos: number, letter: string, guessed: boolean) =>
    guessed
      ? `Spot ${pos} is ${letter}, because it's the first spot your guesses haven't found yet.`
      : `Spot ${pos} is ${letter}. Start from there and build the word around it.`,
  hintShown: (pos: number, letter: string) => `Spot ${pos} is ${letter}.`,
  keySay: (letter: string, mark: number | undefined) => (mark === undefined ? letter : `${letter}, ${KEY_SAY[mark]}`),
};
