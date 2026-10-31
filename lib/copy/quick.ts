/**
 * Player-facing copy for the quick games: the timed quiz board (Quickfire, Flagged), Quads and Merge.
 * Same voice as `lib/copy/index.ts`: short, warm, plain.
 */
import { formatNumber } from "@/lib/format";

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

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
    rightAnswer: ", right answer",
    yourWrongAnswer: ", your answer, wrong",
    /** the end-of-run summary, e.g. "4 of 5 · 469 pts" */
    summary: (right: number, total: number, score: number) => `${right} of ${total} · ${formatNumber(score)} pts`,
    summarySay: (right: number, total: number, score: number) =>
      `Finished. ${right} of ${total} right, ${formatNumber(score)} ${plural(score, "point")}.`,
    summaryTitle: "Your run",
  },
  quads: {
    /** level 0 (most direct) to 3 (trickiest); always printed next to the colour */
    levels: ["Easy", "Medium", "Tricky", "Hard"] as const,
    start: "Find four groups of four.",
    startTutorial: "Tap four words that share something, then Submit.",
    starter: (label: string) => `Starter group: ${label}.`,
    checking: "Checking your four…",
    tried: "You tried those four already.",
    offline: "No connection. Submit again.",
    found: (label: string, level: string, n: number) =>
      n >= 4 ? `${label} (${level}). All four groups.` : `${label} (${level}). ${n} of 4 groups.`,
    foundSay: (label: string, level: string, words: string[], n: number) =>
      `Group found: ${label}, ${level}: ${words.join(", ")}. ${n >= 4 ? "All four groups found." : `${n} of 4 groups.`}`,
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
} as const;
