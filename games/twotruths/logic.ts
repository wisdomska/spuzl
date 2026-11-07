/**
 * Two Truths and a Lie (R2-P5, lab game): five rounds, three statements about one theme each, 20 seconds to pick
 * the lie. 100 per lie found plus up to 50 for speed; the hint strikes out one of the two truths.
 *
 * Same transport as Quickfire (games/quickfire/logic.ts): the statements reach the board, which one is the lie
 * never does until it is judged. The board's `ref` is an opaque token; each round goes through the guess
 * transport twice, `{ q, open: true }` when it appears (its window starts on the server) and `{ q, pick, ms }`
 * when it is answered (pick null on a timeout). On the player's attempt the server keeps both on the move log,
 * judges with its own clock and only then sends right or wrong, the lie and what is true instead. Finish checks
 * that the final state holds exactly the answers the server judged (`audit`), so a score can't be forged.
 * Practice boards (the guided round, the admin preview, the dev fixture) are judged at once.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { ContentRef, GuessContext, GuessLogic } from "@/games/_shared/guess";
import { checkTimedAnswers, READ_FLOOR_MS, rotation, timedScore } from "@/games/_shared/cluecave";
import { createRng, type Rng } from "@/lib/rng";
import { CONTENT, PRACTICE, type TruthsRound } from "./content";
import {
  FREE_BASE,
  LIMIT_MS,
  NET_SLACK_MS,
  OPTIONS,
  PRACTICE_INDEX,
  ROUNDS,
  type TruthsCheck,
  type TruthsGuess,
  type TruthsPuzzle,
  type TruthsSolution,
  type TruthsState,
  type TruthsVerdict,
} from "./rules";

export { FREE_BASE, LIMIT_MS, OPTIONS, PRACTICE_INDEX, ROUNDS };

const LEVELS_FOR: Record<Difficulty, number[]> = { easy: [1, 2], medium: [1, 2, 3], hard: [2, 3], expert: [2, 3], mega: [1, 2, 3] };

/** The board's string key ("d<day>", "f<seed>" or "p"): it seeds the statement order and the hint. */
function boardKey(ref: unknown): string {
  const i = (ref as Partial<ContentRef> | null)?.i;
  if (!Number.isInteger(i)) return "x";
  if (i === PRACTICE_INDEX) return "p";
  return i! >= FREE_BASE ? `f${i! - FREE_BASE}` : `d${i}`;
}

/** Mean round level mapped onto 0..100. */
export function gradeOf(rounds: TruthsRound[]) {
  const mean = rounds.reduce((a, r) => a + r.level, 0) / rounds.length;
  return Math.round(((mean - 1) / 2) * 80 + 10);
}

export function build(rounds: TruthsRound[], i: number, d: Difficulty): Generated<TruthsPuzzle, TruthsSolution> {
  const rng = createRng(`tt-order:${boardKey({ i })}`);
  const lie: number[] = [];
  const views = rounds.map((r) => {
    const statements = rng.shuffle([r.truths[0], r.truths[1], r.lie]);
    lie.push(statements.indexOf(r.lie));
    return { theme: r.theme, statements };
  });
  return {
    puzzle: { ref: { game: "twotruths", i, d }, rounds: views, limitMs: LIMIT_MS },
    solution: { lie, fix: rounds.map((r) => r.fix) },
    grade: gradeOf(rounds),
  };
}

/** Free play: five rounds at the difficulty's levels, at most two from one theme. */
function freePicks(rng: Rng, difficulty: Difficulty): TruthsRound[] {
  const levels = LEVELS_FOR[difficulty] ?? LEVELS_FOR.easy;
  const pool = rng.shuffle(CONTENT.filter((r) => levels.includes(r.level)));
  const picked: TruthsRound[] = [];
  for (const r of pool) {
    if (picked.length === ROUNDS) break;
    if (picked.filter((x) => x.theme === r.theme).length < 2) picked.push(r);
  }
  return picked;
}

/** One Daily board per index. */
export const contentCount = Math.floor(CONTENT.length / ROUNDS);

/**
 * Daily (index below FREE_BASE): five consecutive slots of a fixed permutation, so no round repeats on consecutive
 * days. Free play (FREE_BASE + seed): the seed's board at that difficulty. PRACTICE_INDEX: the practice board.
 * Either way the content reference rebuilds the board, so it is never sent to players as is.
 */
export function generateAt(index: number, difficulty: Difficulty = "easy"): Generated<TruthsPuzzle, TruthsSolution> {
  if (index === PRACTICE_INDEX) return build(PRACTICE, index, "easy");
  if (index >= FREE_BASE) return build(freePicks(createRng(`tt-free:${index - FREE_BASE}`), difficulty), index, difficulty);
  const picks = rotation(CONTENT.length, ROUNDS, index, "twotruths");
  return build(
    picks.map((k) => CONTENT[k]),
    index,
    difficulty,
  );
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<TruthsPuzzle, TruthsSolution> {
  return generateAt(FREE_BASE + rng.int(0, FREE_BASE - 1), difficulty);
}

/** The guided first play: two easy rounds (public answers). */
export function practice(): Generated<TruthsPuzzle, TruthsSolution> {
  return generateAt(PRACTICE_INDEX);
}

export function verify(p: TruthsPuzzle, sol: TruthsSolution, state: TruthsState): VerifyResult {
  const bad = checkTimedAnswers(state?.answers, p.rounds.length, OPTIONS, p.limitMs);
  if (bad) return { ok: false, progress: progress(p, sol, state), reason: bad };
  return { ok: true, progress: 1, score: timedScore(state.answers, sol.lie, p.limitMs).score };
}

/** Rounds answered, never which were right. */
export function progress(p: TruthsPuzzle, _sol: TruthsSolution, state: TruthsState): number {
  const n = Array.isArray(state?.answers) ? Math.min(state.answers.length, p.rounds.length) : 0;
  return n / p.rounds.length;
}

/** Strikes out one of the current round's two truths. */
export function hint(p: TruthsPuzzle, sol: TruthsSolution, state: TruthsState): Hint | null {
  const i = Array.isArray(state?.answers) ? state.answers.length : 0;
  if (i >= p.rounds.length) return null;
  const truths = [0, 1, 2].filter((k) => k !== sol.lie[i]);
  const drop = createRng(`tt-hint:${boardKey(p.ref)}:${i}`).pick(truths);
  return { target: { question: i, remove: [drop] }, text: "One true statement is gone." };
}

/* ---------- Server check per answer (guess transport) ---------- */

interface Judged {
  q: number;
  pick: number | null;
  ms: number;
  late: boolean;
}

/** The attempt's move log: when each round opened (server ms) and the answers judged, in order. */
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

const isOpen = (g: TruthsGuess): g is { q: number; open: true } => (g as { open?: unknown }).open === true;

function validGuess(p: TruthsPuzzle, g: TruthsGuess): boolean {
  if (!g || typeof g !== "object" || !Number.isInteger(g.q) || g.q < 0 || g.q >= p.rounds.length) return false;
  if (isOpen(g)) return true;
  const { pick, ms } = g as { pick: unknown; ms: unknown };
  if (pick !== null && (!Number.isInteger(pick) || (pick as number) < 0 || (pick as number) >= OPTIONS)) return false;
  return typeof ms === "number" && Number.isFinite(ms) && ms >= 0 && ms <= p.limitMs;
}

const judged = (s: TruthsSolution, j: Judged): TruthsVerdict => ({
  ...j,
  right: j.pick !== null && j.pick === s.lie[j.q],
  answer: s.lie[j.q],
  fix: s.fix[j.q] ?? "",
});

/**
 * Opens or answers one round. As practice the pick is judged at once with its own time. On an attempt, rounds go
 * in order: each must be opened before it is answered, an answer counts once (asking again returns the same
 * verdict), and its time is the server's. With no context (a bare reference, a race round) nothing is answered.
 */
export function checkGuess(p: TruthsPuzzle, s: TruthsSolution, g: TruthsGuess, ctx: GuessContext = null): TruthsCheck {
  if (!validGuess(p, g)) return { ok: false, invalid: true };
  if (!ctx) return { ok: false, refused: true };
  const limit = p.limitMs;
  if (ctx.kind === "practice") {
    if (isOpen(g)) return { ok: true, leftMs: limit };
    const ms = g.pick === null ? limit : Math.min(limit, Math.max(READ_FLOOR_MS, Math.round(g.ms)));
    return { ok: true, verdict: judged(s, { q: g.q, pick: g.pick, ms, late: false }) };
  }
  const now = ctx.now ?? Date.now();
  const { opens, answers } = readLog(ctx.log);
  const done = answers[g.q];
  if (done) return { ok: true, leftMs: 0, verdict: judged(s, done) };
  if (g.q !== answers.length) return { ok: false, refused: true };
  const openedAt = opens.get(g.q);
  if (isOpen(g)) return { ok: true, leftMs: openedAt === undefined ? limit : Math.max(0, Math.min(limit, limit - (now - openedAt))) };
  if (openedAt === undefined) return { ok: false, refused: true };
  const elapsed = now - openedAt;
  const late = elapsed > limit + NET_SLACK_MS;
  if (late || g.pick === null) return { ok: true, verdict: judged(s, { q: g.q, pick: null, ms: limit, late }) };
  const ms = Math.round(Math.min(limit, Math.max(g.ms, elapsed - NET_SLACK_MS, READ_FLOOR_MS)));
  return { ok: true, verdict: judged(s, { q: g.q, pick: g.pick, ms, late: false }) };
}

/** Kept on the attempt: each round's first open, and each answer once, before its verdict is sent. */
export function record(_p: TruthsPuzzle, _s: TruthsSolution, g: TruthsGuess, res: TruthsCheck, log: unknown[]) {
  if (!res.ok) return null;
  const { opens, answers } = readLog(log);
  if (answers[g.q]) return null;
  if (isOpen(g)) return opens.has(g.q) ? null : { q: g.q, open: true };
  const v = res.verdict;
  return v ? { q: v.q, pick: v.pick, ms: v.ms, late: v.late } : null;
}

/** The final state must hold exactly the answers the server judged, with the times it gave them. */
export function audit(_p: TruthsPuzzle, _s: TruthsSolution, state: TruthsState, log: unknown[]): string | null {
  const { answers } = readLog(log);
  const mine = Array.isArray(state?.answers) ? state.answers : [];
  for (let i = 0; i < mine.length; i++) {
    const j = answers[i];
    if (!j) return "answer the server never judged";
    if (mine[i]?.pick !== j.pick || mine[i]?.ms !== j.ms) return "answer differs from the server's record";
  }
  return answers.length > mine.length ? "judged answer missing from the state" : null;
}

const logic: GuessLogic<TruthsPuzzle, TruthsSolution, TruthsState, TruthsGuess, TruthsCheck> = {
  id: "twotruths",
  contentCount,
  generateAt,
  generate,
  practice,
  checkGuess,
  record,
  audit,
  verify,
  progress,
  hint,
};
export default logic;
