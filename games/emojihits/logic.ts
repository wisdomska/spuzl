/**
 * Emoji Hits: name the song, film or TV show from a row of emoji. Five rounds, three tries each, a time bar
 * per round. Easy days also offer four titles to pick from. Titles stay on the server: the board sends each
 * try through the guess transport. Score: 100 per title found, up to 50 more for speed, 20 off per wrong try.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { GuessLogic } from "@/games/_shared/guess";
import { rotation } from "@/games/_shared/cluecave";
import { EMOJI_COPY } from "@/lib/copy/emojihits";
import { createRng, type Rng } from "@/lib/rng";
import { CONTENT, type HitEntry } from "./content";
import {
  isTry,
  LIMIT_MS,
  OPTIONS,
  READ_FLOOR_MS,
  roundScore,
  ROUNDS,
  titleKey,
  titleMatches,
  TRIES,
  type EmojiCheck,
  type EmojiGuess,
  type EmojiPuzzle,
  type EmojiSolution,
  type EmojiState,
  type HitTry,
  type RoundLog,
} from "./rules";

/** One Daily pack per index. The pool size is not a multiple of 5, so every index starts a different pack. */
export const contentCount = CONTENT.length;

const DAY_WEIGHT: Record<Difficulty, number> = { easy: 10, medium: 30, hard: 45, expert: 55, mega: 65 };

const wordsIn = (title: string) => title.split(/\s+/).filter(Boolean).length;

export function clueFor(e: HitEntry): string {
  return e.clue ?? EMOJI_COPY.clue(e.kind, e.year, e.by);
}

/** Three wrong titles of the same kind, never one that would also match the answer. */
function distractors(e: HitEntry, rng: Rng): string[] {
  const out: string[] = [];
  const same = rng.shuffle(CONTENT.filter((o) => o !== e && o.kind === e.kind));
  for (const o of same) {
    if (titleMatches(o.title, [e.title, ...(e.accept ?? [])])) continue;
    out.push(o.title);
    if (out.length === OPTIONS - 1) break;
  }
  return out;
}

/** Older, longer and less global titles are harder; harder days drop the options. */
export function grade(entries: HitEntry[], d: Difficulty): number {
  const local = entries.filter((e) => e.from !== "world").length;
  const long = entries.reduce((a, e) => a + Math.min(4, wordsIn(e.title)), 0) / entries.length;
  return Math.max(0, Math.min(100, Math.round(DAY_WEIGHT[d] + local * 2 + long * 3)));
}

export function generateAt(index: number, difficulty: Difficulty): Generated<EmojiPuzzle, EmojiSolution> {
  const i = ((index % contentCount) + contentCount) % contentCount;
  const entries = rotation(contentCount, ROUNDS, i, "emojihits").map((k) => CONTENT[k]);
  const rng = createRng(`emojihits:${i}:${difficulty}`);
  const rounds = entries.map((e) => {
    const round: EmojiPuzzle["rounds"][number] = { emoji: e.emoji, kind: e.kind, words: wordsIn(e.title) };
    if (difficulty === "easy") round.options = rng.shuffle([e.title, ...distractors(e, rng)]);
    return round;
  });
  return {
    puzzle: { ref: { game: "emojihits", i, d: difficulty }, rounds, limitMs: LIMIT_MS, tries: TRIES },
    solution: { answers: entries.map((e) => [e.title, ...(e.accept ?? [])]), clues: entries.map(clueFor) },
    grade: grade(entries, difficulty),
  };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<EmojiPuzzle, EmojiSolution> {
  return generateAt(rng.int(0, contentCount - 1), difficulty);
}

/** One try against one round: typed text (forgiving) or, on easy, a picked option. */
export function tryMatches(p: EmojiPuzzle, s: EmojiSolution, round: number, t: HitTry): boolean {
  const accepted = s.answers[round];
  if (typeof t === "number") {
    const picked = p.rounds[round].options?.[t];
    return picked !== undefined && titleKey(picked) === titleKey(accepted[0]);
  }
  return titleMatches(t, accepted);
}

const validRound = (p: EmojiPuzzle, r: unknown): r is number =>
  Number.isInteger(r) && (r as number) >= 0 && (r as number) < p.rounds.length;

/** Pure check of one try, for the server guess API. A reveal shows the title once a round is over. */
export function checkGuess(p: EmojiPuzzle, s: EmojiSolution, g: EmojiGuess): EmojiCheck {
  if (!g || typeof g !== "object" || !validRound(p, g.round)) return { ok: false, invalid: true };
  if ("reveal" in g && g.reveal === true) return { reveal: s.answers[g.round][0] };
  if (!("answer" in g) || !isTry(g.answer)) return { ok: false, invalid: true };
  if (typeof g.answer === "number" && !p.rounds[g.round].options) return { ok: false, invalid: true };
  return tryMatches(p, s, g.round, g.answer) ? { ok: true, title: s.answers[g.round][0] } : { ok: false };
}

interface RoundResult {
  right: boolean;
  wrong: number;
  ms: number;
}

/** Replays the log. Null when a round is malformed, tries go on after a right one, or a time is implausible. */
export function replay(p: EmojiPuzzle, s: EmojiSolution, state: EmojiState): RoundResult[] | null {
  if (!state || typeof state !== "object" || !Array.isArray(state.rounds) || state.rounds.length > p.rounds.length) return null;
  const out: RoundResult[] = [];
  for (let r = 0; r < state.rounds.length; r++) {
    const log = state.rounds[r] as RoundLog;
    if (!log || !Array.isArray(log.tries) || log.tries.length > p.tries) return null;
    if (!Number.isInteger(log.ms) || log.ms < 0 || log.ms > p.limitMs) return null;
    let right = false;
    let wrong = 0;
    for (const t of log.tries) {
      if (right || !isTry(t) || (typeof t === "number" && !p.rounds[r].options)) return null;
      if (tryMatches(p, s, r, t)) right = true;
      else wrong++;
    }
    if (right && log.ms < READ_FLOOR_MS) return null;
    out.push({ right, wrong, ms: log.ms });
  }
  return out;
}

/** 100 per title found, plus up to 50 for speed, minus 20 per wrong try in that round (never below 40). */
export function scoreOf(results: RoundResult[], limitMs: number) {
  let score = 0;
  let right = 0;
  for (const r of results) {
    if (!r.right) continue;
    right++;
    score += roundScore(r.wrong, r.ms, limitMs);
  }
  return { score, right };
}

/** A finished run (all five rounds played) is a clear; the score says how well it went. */
export function verify(p: EmojiPuzzle, s: EmojiSolution, state: EmojiState): VerifyResult {
  const res = replay(p, s, state);
  if (!res) return { ok: false, progress: 0, reason: "malformed or implausible log" };
  if (res.length < p.rounds.length) return { ok: false, progress: res.length / p.rounds.length, reason: "incomplete" };
  return { ok: true, progress: 1, score: scoreOf(res, p.limitMs).score };
}

export function progress(p: EmojiPuzzle, s: EmojiSolution, state: EmojiState): number {
  return (replay(p, s, state)?.length ?? 0) / p.rounds.length;
}

/** For the round in play: who made it and when, in one line. */
export function hint(p: EmojiPuzzle, s: EmojiSolution, state: EmojiState): Hint | null {
  const done = Array.isArray(state?.rounds) ? state.rounds.length : 0;
  if (done >= p.rounds.length) return null;
  return { target: { round: done }, text: s.clues[done] };
}

const logic: GuessLogic<EmojiPuzzle, EmojiSolution, EmojiState, EmojiGuess, EmojiCheck> = {
  id: "emojihits",
  contentCount,
  generate,
  generateAt,
  checkGuess,
  verify,
  progress,
  hint,
};
export default logic;
