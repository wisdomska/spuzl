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
} as const;
