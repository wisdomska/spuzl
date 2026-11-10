/**
 * Quickfire: 5 trivia questions, 15 seconds each, tap one of 4 answers.
 * 100 per right answer plus up to 50 for speed. The hint is a 50:50 on the current question.
 *
 * The answers stay on the server, and on scored boards so do the questions (R4-23): an attempt or race board is
 * served as its question count and time limit only (`scoredView`, games/quickfire/view.ts), and its `ref` is an
 * opaque token (games/_shared/guess.ts). Each question goes through the guess transport twice: `{ q, open: true }`
 * when it appears, which starts its window on the server and only then hands out the question and its options,
 * and `{ q, pick, ms }` when it is answered (pick null on a timeout). On the player's attempt the server keeps both on the move log, judges the answer and only then
 * says right or wrong and which option was right. Time is the server's: an answer that reaches it more than
 * NET_SLACK_MS after the window closed counts as a timeout, and the scored time is never put more than
 * NET_SLACK_MS under the server's own measure. Finish checks that the final state holds exactly the answers
 * the server judged (`audit`), so a score can't be forged.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { ContentRef, GuessContext, GuessLogic, PuzzleRef } from "@/games/_shared/guess";
import { createRng, type Rng } from "@/lib/rng";
import { checkTimedAnswers, READ_FLOOR_MS, rotation, timedScore, type TimedAnswer } from "@/games/_shared/cluecave";
import { liveContent } from "@/games/_shared/live";
import { CONTENT, type QuickfireCategory, type QuickfireItem } from "./content";
import { QUIZ_SETS, quizSetIndex } from "./sets";

export const QUESTIONS = 5;
export const OPTIONS = 4;
export const LIMIT_MS = 15000;
/** Network allowance on the server's clock, both for a late answer and for the time it scores. */
export const NET_SLACK_MS = 3000;
/** Content indexes from here up are free play boards (FREE_BASE + seed); below are Daily rotation days. */
export const FREE_BASE = 1_000_000_000;
/**
 * Event quiz rounds (R2-P5): SET_BASE + set × 1000 + round. Free boards stop below it (FREE_BASE + seed, seed under
 * FREE_BASE), so the three ranges never meet.
 */
export const SET_BASE = 2_000_000_000;

export interface QuickfireQuestion {
  q: string;
  cat: QuickfireCategory;
  choices: string[];
}
export interface QuickfirePuzzle {
  /** a content reference where it is built; an opaque token once served */
  ref: PuzzleRef;
  questions: QuickfireQuestion[];
  limitMs: number;
}
export interface QuickfireSolution {
  correct: number[];
}
/** An answer as the board keeps it: the judged pick and time, and once judged, whether it was right. */
export interface QuickfireAnswer extends TimedAnswer {
  right?: boolean;
  /** the right option, shown after the answer */
  answer?: number;
}
export interface QuickfireState {
  answers: QuickfireAnswer[];
}

/** `open` when the question appears; otherwise its answer (pick null when the time ran out). */
export type QuickfireGuess = { q: number; open: true } | { q: number; pick: number | null; ms: number };
export interface QuickfireVerdict {
  q: number;
  pick: number | null;
  /** the time that scores (the limit on a timeout) */
  ms: number;
  right: boolean;
  answer: number;
  /** the answer reached the server after the window: it counts as a timeout */
  late: boolean;
}
/**
 * `leftMs`: the time left in the question's window (an open); `question`: the question and its options, handed
 * out on its open once that open is on the server's record; `verdict`: the judged answer (an answer, or an open
 * of a question the server already judged, so a resumed board catches up).
 */
export type QuickfireCheck =
  | { ok: true; leftMs?: number; question?: QuickfireQuestion; verdict?: QuickfireVerdict }
  | { ok: false; refused: true }
  | { ok: false; invalid: true };

const LEVELS_FOR: Record<Difficulty, number[]> = { easy: [1], medium: [1, 2], hard: [2, 3], expert: [3, 2], mega: [1, 2, 3] };

/** The legacy string key of a board ("d<day>" or "f<seed>"): it seeds the option order and the 50:50. */
function boardKey(ref: unknown): string {
  if (typeof ref === "string") return ref;
  const i = (ref as Partial<ContentRef> | null)?.i;
  if (!Number.isInteger(i)) return "x";
  return i! >= FREE_BASE ? `f${i! - FREE_BASE}` : `d${i}`;
}

function build(items: QuickfireItem[], i: number, d: Difficulty): Generated<QuickfirePuzzle, QuickfireSolution> {
  const rng = createRng(`qf-choices:${boardKey({ i })}`);
  const correct: number[] = [];
  const questions = items.map((it) => {
    const choices = rng.shuffle([it.answer, ...it.wrong]);
    correct.push(choices.indexOf(it.answer));
    return { q: it.q, cat: it.cat, choices };
  });
  return {
    puzzle: { ref: { game: "quickfire", i, d }, questions, limitMs: LIMIT_MS },
    solution: { correct },
    grade: gradeOf(items),
  };
}

/** Mean question level mapped onto 0..100. */
export function gradeOf(items: QuickfireItem[]) {
  const mean = items.reduce((a, it) => a + it.level, 0) / items.length;
  return Math.round(((mean - 1) / 2) * 80 + 10);
}

export const contentCount = Math.floor(CONTENT.length / QUESTIONS);

/** Five questions at the difficulty's levels, at most two from one category. */
function freePicks(rng: Rng, difficulty: Difficulty): QuickfireItem[] {
  const levels = LEVELS_FOR[difficulty] ?? LEVELS_FOR.easy;
  const pool = rng.shuffle(liveContent("quickfire", CONTENT).filter((it) => levels.includes(it.level)));
  const picked: QuickfireItem[] = [];
  for (const it of pool) {
    if (picked.length === QUESTIONS) break;
    if (picked.filter((x) => x.cat === it.cat).length < 2) picked.push(it);
  }
  return picked;
}

/**
 * Daily (index below FREE_BASE): five consecutive slots of a fixed permutation, so no question repeats on
 * consecutive days. Free play (FREE_BASE + seed): the seed's board at that difficulty. Either way the content
 * reference rebuilds the board, so it is never sent to players as is.
 */
export function generateAt(index: number, difficulty: Difficulty = "easy"): Generated<QuickfirePuzzle, QuickfireSolution> {
  if (index >= SET_BASE) return build(setRound(index - SET_BASE), index, difficulty);
  if (index >= FREE_BASE) return build(freePicks(createRng(`qf-free:${index - FREE_BASE}`), difficulty), index, difficulty);
  const list = liveContent("quickfire", CONTENT); // round 3 item 12: retired questions left out, edited ones swapped in
  const picks = rotation(list.length, QUESTIONS, index, "quickfire");
  return build(
    picks.map((i) => list[i]),
    index,
    difficulty,
  );
}

/** The five questions of one event quiz round (k = set × 1000 + round); an unknown set or round throws. */
function setRound(k: number): QuickfireItem[] {
  const set = QUIZ_SETS[Math.floor(k / 1000)];
  const round = k % 1000;
  const items = set?.items.slice(round * QUESTIONS, round * QUESTIONS + QUESTIONS) ?? [];
  if (items.length !== QUESTIONS) throw new Error(`no quiz round ${k}`);
  return items;
}

/** How many rounds of five a quiz set holds (0 for an unknown set). */
export function quizRounds(setId: string): number {
  const i = quizSetIndex(setId);
  return i < 0 ? 0 : Math.floor(QUIZ_SETS[i].items.length / QUESTIONS);
}

/**
 * A free board from an event's quiz set (lib/events EVENT_QUIZZES): one of its rounds, picked by the seed, so the
 * attempt's server seed rebuilds the same board at finish. Null for an unknown set.
 */
export function quizSetBoard(setId: string, rng: Rng, difficulty: Difficulty): Generated<QuickfirePuzzle, QuickfireSolution> | null {
  const rounds = quizRounds(setId);
  if (!rounds) return null;
  return generateAt(SET_BASE + quizSetIndex(setId) * 1000 + rng.int(0, rounds - 1), difficulty);
}

/** Free play: a fresh free board from the seed. */
export function generate(rng: Rng, difficulty: Difficulty): Generated<QuickfirePuzzle, QuickfireSolution> {
  return generateAt(FREE_BASE + rng.int(0, FREE_BASE - 1), difficulty);
}

export function verify(p: QuickfirePuzzle, sol: QuickfireSolution, state: QuickfireState): VerifyResult {
  const bad = checkTimedAnswers(state?.answers, p.questions.length, OPTIONS, p.limitMs);
  if (bad) return { ok: false, progress: progress(p, sol, state), reason: bad };
  return { ok: true, progress: 1, score: timedScore(state.answers, sol.correct, p.limitMs).score };
}

/** Questions answered, never which were right. */
export function progress(p: QuickfirePuzzle, _sol: QuickfireSolution, state: QuickfireState): number {
  const n = Array.isArray(state?.answers) ? Math.min(state.answers.length, p.questions.length) : 0;
  return n / p.questions.length;
}

/** 50:50 on the current question: names two wrong choices to strike out. */
export function hint(p: QuickfirePuzzle, sol: QuickfireSolution, state: QuickfireState): Hint | null {
  const i = Array.isArray(state?.answers) ? state.answers.length : 0;
  if (i >= p.questions.length) return null;
  const wrong = [0, 1, 2, 3].filter((k) => k !== sol.correct[i]);
  const drop = createRng(`qf-hint:${boardKey(p.ref)}:${i}`)
    .shuffle(wrong)
    .slice(0, 2)
    .sort();
  return { target: { question: i, remove: drop }, text: "Two wrong answers are gone." };
}

/* ---------- Server check per answer (guess transport) ---------- */

interface Judged {
  q: number;
  pick: number | null;
  ms: number;
  late: boolean;
}

/** The attempt's move log: when each question opened (server ms) and the answers judged, in order. */
function readLog(log: unknown[]): { opens: Map<number, number>; answers: Judged[] } {
  const opens = new Map<number, number>();
  const answers: Judged[] = [];
  for (const e of Array.isArray(log) ? log : []) {
    const x = e as Partial<Judged & { open: boolean; t: number }> | null;
    if (!x || typeof x !== "object" || !Number.isInteger(x.q)) continue;
    if (x.open === true) {
      if (!opens.has(x.q!) && Number.isFinite(x.t)) opens.set(x.q!, x.t!);
    } else if (x.q === answers.length && Number.isInteger(x.ms))
      answers.push({ q: x.q!, pick: Number.isInteger(x.pick) ? x.pick! : null, ms: x.ms!, late: x.late === true });
  }
  return { opens, answers };
}

const isOpen = (g: QuickfireGuess): g is { q: number; open: true } => (g as { open?: unknown }).open === true;

function validGuess(p: QuickfirePuzzle, g: QuickfireGuess): boolean {
  if (!g || typeof g !== "object" || !Number.isInteger(g.q) || g.q < 0 || g.q >= p.questions.length) return false;
  if (isOpen(g)) return true;
  const { pick, ms } = g as { pick: unknown; ms: unknown };
  if (pick !== null && (!Number.isInteger(pick) || (pick as number) < 0 || (pick as number) >= OPTIONS)) return false;
  return typeof ms === "number" && Number.isFinite(ms) && ms >= 0 && ms <= p.limitMs;
}

const judged = (s: QuickfireSolution, j: Judged): QuickfireVerdict => ({
  ...j,
  right: j.pick !== null && j.pick === s.correct[j.q],
  answer: s.correct[j.q],
});

/**
 * Opens or answers one question; an open also hands out the question (its text, category and options), never a
 * later one. As practice (the guided board, the admin preview, the dev fixture) the pick is judged at once with
 * its own time. On an attempt, questions go in order: each must be opened before it is
 * answered, an answer counts once (asking again returns the same verdict), and its time is the server's (see
 * the file comment). With no context (a bare reference, a race round) nothing is answered.
 */
export function checkGuess(p: QuickfirePuzzle, s: QuickfireSolution, g: QuickfireGuess, ctx: GuessContext = null): QuickfireCheck {
  if (!validGuess(p, g)) return { ok: false, invalid: true };
  if (!ctx) return { ok: false, refused: true };
  const limit = p.limitMs;
  const question = p.questions[g.q];
  if (ctx.kind === "practice") {
    if (isOpen(g)) return { ok: true, leftMs: limit, question };
    const ms = g.pick === null ? limit : Math.min(limit, Math.max(READ_FLOOR_MS, Math.round(g.ms)));
    return { ok: true, verdict: judged(s, { q: g.q, pick: g.pick, ms, late: false }) };
  }
  const now = ctx.now ?? Date.now();
  const { opens, answers } = readLog(ctx.log);
  const done = answers[g.q];
  if (done)
    return isOpen(g) ? { ok: true, leftMs: 0, question, verdict: judged(s, done) } : { ok: true, leftMs: 0, verdict: judged(s, done) };
  // A later question is neither opened nor shown before this one is answered.
  if (g.q !== answers.length) return { ok: false, refused: true };
  const openedAt = opens.get(g.q);
  if (isOpen(g))
    return { ok: true, leftMs: openedAt === undefined ? limit : Math.max(0, Math.min(limit, limit - (now - openedAt))), question };
  if (openedAt === undefined) return { ok: false, refused: true };
  const elapsed = now - openedAt;
  const late = elapsed > limit + NET_SLACK_MS;
  if (late || g.pick === null) return { ok: true, verdict: judged(s, { q: g.q, pick: null, ms: limit, late }) };
  const ms = Math.round(Math.min(limit, Math.max(g.ms, elapsed - NET_SLACK_MS, READ_FLOOR_MS)));
  return { ok: true, verdict: judged(s, { q: g.q, pick: g.pick, ms, late: false }) };
}

/** Kept on the attempt: each question's first open, and each answer once, before its verdict is sent. */
export function record(_p: QuickfirePuzzle, _s: QuickfireSolution, g: QuickfireGuess, res: QuickfireCheck, log: unknown[]) {
  if (!res.ok) return null;
  const { opens, answers } = readLog(log);
  if (answers[g.q]) return null;
  if (isOpen(g)) return opens.has(g.q) ? null : { q: g.q, open: true };
  const v = res.verdict;
  return v ? { q: v.q, pick: v.pick, ms: v.ms, late: v.late } : null;
}

/** The final state must hold exactly the answers the server judged, with the times it gave them. */
export function audit(_p: QuickfirePuzzle, _s: QuickfireSolution, state: QuickfireState, log: unknown[]): string | null {
  const { answers } = readLog(log);
  const mine = Array.isArray(state?.answers) ? state.answers : [];
  for (let i = 0; i < mine.length; i++) {
    const j = answers[i];
    if (!j) return "answer the server never judged";
    if (mine[i]?.pick !== j.pick || mine[i]?.ms !== j.ms) return "answer differs from the server's record";
  }
  return answers.length > mine.length ? "judged answer missing from the state" : null;
}

const logic: GuessLogic<QuickfirePuzzle, QuickfireSolution, QuickfireState, QuickfireGuess, QuickfireCheck> = {
  id: "quickfire",
  contentCount,
  generateAt,
  generate,
  checkGuess,
  record,
  audit,
  verify,
  progress,
  hint,
};
export default logic;
