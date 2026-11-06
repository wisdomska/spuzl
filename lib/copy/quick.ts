/**
 * Player-facing copy for the quick games: the timed quiz board (Quickfire, Flagged), Quads and Merge.
 * Same voice as `lib/copy/index.ts`: short, warm, plain.
 */
import { formatNumber } from "@/lib/format";

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
/** Quads: every group of the board found (4 on a real board, 2 on the practice round). */
const allGroups = (of: number) => (of === 2 ? "Both groups" : of === 4 ? "All four groups" : `All ${of} groups`);

export const quick = {
  quiz: {
    start: "Start",
    resume: "Resume",
    done: "Done",
    fiftyFifty: "50:50",
    answers: "Answers",
    timeLeft: "Time left for this question",
    /** "Question 2 of 5" */
    step: (noun: string, n: number, total: number) => `${noun} ${n} of ${total}`,
    answered: (n: number, total: number) => `${n} of ${total} answered`,
    intro: (total: number, noun: string, secs: number) => `${total} ${noun.toLowerCase()}s, ${secs} seconds each.`,
    introTutorial: "Press Start. Tap an answer before the bar runs out.",
    /** shown in the card before Start, so the answers stay hidden until the clock runs */
    ready: "Answers appear when you press Start.",
    resumeNext: (noun: string, n: number, total: number) => `${noun} ${n} of ${total} is next. Press Resume.`,
    right: (answer: string) => `Right. ${answer}.`,
    wrong: (answer: string) => `Not quite. It was ${answer}.`,
    time: (answer: string) => `Time. It was ${answer}.`,
    timeSay: (answer: string) => `Time is up. It was ${answer}.`,
    /** the answer reached the server after the question's time ran out */
    late: (answer: string) => `Too late to count. It was ${answer}.`,
    /** shown when the server takes a moment to judge an answer */
    checking: "Checking your answer…",
    offline: "No connection. Your answer is kept; tap Try again.",
    retry: "Try again",
    /** before Start: the question clock is the server's, so pausing does not stop it */
    clockRuns: "The clock keeps running if you pause mid-question.",
    rightAnswer: ", right answer",
    yourWrongAnswer: ", your answer, wrong",
    yourAnswerChecking: ", your answer, checking",
    /** the end-of-run summary, e.g. "4 of 5 · 469 pts" */
    summary: (right: number, total: number, score: number) => `${right} of ${total} · ${formatNumber(score)} pts`,
    summarySay: (right: number, total: number, score: number) =>
      `Finished. ${right} of ${total} right, ${formatNumber(score)} ${plural(score, "point")}.`,
    summaryTitle: "Your run",
  },
  quads: {
    /** level 0 (most direct) to 3 (trickiest); always printed next to the colour and its shape */
    levels: ["Easy", "Medium", "Hard", "Tricky"] as const,
    start: "Find four groups of four.",
    startTutorial: "Tap four words that share something, then Submit.",
    starter: (label: string) => `Starter group: ${label}.`,
    checking: "Checking your four…",
    tried: "You tried those four already.",
    offline: "No connection. Submit again.",
    found: (label: string, level: string, n: number, of = 4) =>
      n >= of ? `${label} (${level}). ${allGroups(of)}.` : `${label} (${level}). ${n} of ${of} groups.`,
    foundSay: (label: string, level: string, words: string[], n: number, of = 4) =>
      `Group found: ${label}, ${level}: ${words.join(", ")}. ${n >= of ? `${allGroups(of)} found.` : `${n} of ${of} groups.`}`,
    oneAway: (left: number) => `One away. ${left} ${plural(left, "slip")} left.`,
    notGroup: (left: number) => `Not a group. ${left} ${plural(left, "slip")} left.`,
    outOfSlips: "Out of slips. The groups stay hidden this time.",
    lifted: (w: string, n: number) => `${w} lifted. ${n} of 4.`,
    putDown: (w: string, n: number) => `${w} put down. ${n} of 4 lifted.`,
    fourLifted: "Four already lifted. Submit or put one down.",
    shuffled: "Words shuffled.",
    shuffle: "Shuffle",
    deselect: "Deselect",
    submit: "Submit",
    hint: "Hint",
    grid: "Quads words",
    wordSay: (w: string, lifted: boolean, hinted: boolean, checking: boolean) =>
      `${w}${lifted ? ", lifted" : ""}${checking ? ", checking" : ""}${hinted ? ", hinted" : ""}`,
    slipsLeft: "Slips left",
    slipsSay: (n: number, of: number) => `${n} of ${of} slips left`,
    groupSay: (label: string, level: string, words: string[]) => `${level} group: ${label}. ${words.join(", ")}.`,
  },
  merge: {
    time: "Time",
    hurry: "Last 20 seconds",
    timeBar: "Time left in this run",
    /** coarse words for the time bar: the header holds the one exact clock */
    timeSay: (ms: number) => {
      const s = Math.ceil(ms / 1000);
      if (s <= 0) return "Time is up";
      if (s <= 20) return "Under 20 seconds left";
      if (s <= 60) return "Under a minute left";
      const m = Math.ceil(s / 60);
      return `Under ${m} ${plural(m, "minute")} left`;
    },
    bestTile: "Best tile",
    total: "Total",
    swipeToStart: "Swipe to start the clock.",
  },
} as const;
