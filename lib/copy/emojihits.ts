/** Player-facing copy for Emoji Hits (Clue Cave). Short, warm, plain. */

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export const KIND_LABEL = { song: "Song", film: "Film", tv: "TV show" } as const;
type Kind = keyof typeof KIND_LABEL;

export const EMOJI_COPY = {
  /** server hint line, "A 2022 song by Black Sherif." */
  clue: (kind: Kind, year?: number, by?: string) =>
    `${year ? `A ${year} ${KIND_LABEL[kind].toLowerCase()}` : `A ${KIND_LABEL[kind].toLowerCase()}`}${by ? ` by ${by.replace(/\.$/, "")}` : ""}.`,
  start: "Start",
  resume: "Resume",
  done: "Done",
  skip: "Skip",
  hint: "Hint",
  guess: "Guess",
  intro: (rounds: number, secs: number) => `${rounds} rounds. Name the song, film or TV show from the emoji. ${secs} seconds each.`,
  introTutorial: "Press Start, read the emoji, then type the title. Close spelling is fine.",
  ready: "The emoji appear when you press Start.",
  resumeNext: (n: number, total: number) => `Round ${n} of ${total} is next. Press Resume.`,
  step: (n: number, total: number) => `Round ${n} of ${total}`,
  answered: (n: number, total: number) => `${n} of ${total} rounds played`,
  timeLeft: "Time left for this round",
  clueSay: (kind: Kind, words: number, emoji: string) => `${KIND_LABEL[kind]}, ${words} ${plural(words, "word")}. Emoji clue: ${emoji}`,
  kindLine: (kind: Kind, words: number) => `${KIND_LABEL[kind]} · ${words} ${plural(words, "word")}`,
  inputLabel: "Type the title",
  inputPlaceholder: "Type the title…",
  options: "Pick a title",
  triesLeft: (n: number) => `${n} ${plural(n, "try", "tries")} left`,
  checking: "Checking…",
  offline: "We couldn't check that. Check your connection and try again.",
  empty: "Type a title first.",
  right: (title: string) => `Yes! ${title}.`,
  wrong: (left: number) => `Not that one. ${left} ${plural(left, "try", "tries")} left.`,
  out: (title: string) => `Out of tries. It was ${title}.`,
  time: (title: string) => `Time. It was ${title}.`,
  skipped: (title: string) => `Skipped. It was ${title}.`,
  unknown: "On to the next one.",
  summary: (right: number, total: number, score: number) => `${right} of ${total} · ${score} pts`,
  summarySay: (right: number, total: number, score: number) => `Done. ${right} of ${total} titles, ${score} points.`,
  summaryTitle: "Done",
  roundRight: "found",
  roundMissed: "missed",
  optionSay: (letter: string, title: string, state: "" | "wrong" | "right") =>
    `${letter}, ${title}${state === "wrong" ? ", tried, wrong" : state === "right" ? ", right answer" : ""}`,
};
