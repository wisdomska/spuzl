/**
 * Quads: sort 16 words into 4 hidden groups of 4. The client gets the words only; groups, labels and
 * levels stay on the server. Each submitted four is checked with `checkGuess`; the fourth slip ends the game.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { GuessLogic } from "@/games/_shared/guess";
import { createRng, type Rng } from "@/lib/rng";
import { CONTENT } from "./content";
import { setKey, SLIPS, validGuess, type QuadsCheck, type QuadsGuess, type QuadsPuzzle, type QuadsSolution, type QuadsState } from "./rules";

export const contentCount = CONTENT.length;

/** Difficulty knobs: easy names the most direct group; every day grades by authoring order and day. */
const DAY_WEIGHT: Record<Difficulty, number> = { easy: 10, medium: 30, hard: 45, expert: 55, mega: 65 };

export function grade(entryIndex: number, d: Difficulty, words: string[]): number {
  const longest = Math.max(...words.map((w) => w.length));
  return Math.max(0, Math.min(100, DAY_WEIGHT[d] + (entryIndex % 7) * 2 + Math.min(10, longest)));
}

export function generateAt(index: number, difficulty: Difficulty): Generated<QuadsPuzzle, QuadsSolution> {
  const i = ((index % contentCount) + contentCount) % contentCount;
  const entry = CONTENT[i];
  const rng = createRng(`quads:${i}:${difficulty}`);
  const words = rng.shuffle(entry.groups.flatMap((g) => g.words.slice()));
  const puzzle: QuadsPuzzle = { ref: { game: "quads", i, d: difficulty }, words };
  if (difficulty === "easy") puzzle.starter = entry.groups[0].label;
  const solution: QuadsSolution = { groups: entry.groups.map((g, level) => ({ label: g.label, words: g.words.slice(), level })) };
  return { puzzle, solution, grade: grade(i, difficulty, words) };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<QuadsPuzzle, QuadsSolution> {
  return generateAt(rng.int(0, contentCount - 1), difficulty);
}

/** Pure check of one set of four, for the server guess API. */
export function checkGuess(p: QuadsPuzzle, s: QuadsSolution, guess: QuadsGuess): QuadsCheck {
  if (!validGuess(p, guess)) return { ok: false, oneAway: false, invalid: true };
  const key = setKey(guess);
  const hit = s.groups.find((g) => setKey(g.words) === key);
  if (hit) return { ok: true, group: { label: hit.label, words: hit.words.slice(), level: hit.level } };
  const oneAway = s.groups.some((g) => g.words.filter((w) => guess.includes(w)).length === 3);
  return { ok: false, oneAway };
}

interface Replay {
  solved: number[];
  slips: number;
  bad: boolean;
}

/** Replays the guess log: repeated sets are ignored, anything after the fourth slip or the last group is invalid. */
export function replay(p: QuadsPuzzle, s: QuadsSolution, state: QuadsState): Replay {
  const out: Replay = { solved: [], slips: 0, bad: false };
  if (!state || typeof state !== "object" || !Array.isArray(state.guesses)) return { ...out, bad: true };
  const seen = new Set<string>();
  for (const g of state.guesses) {
    if (out.slips >= SLIPS || out.solved.length === 4 || !validGuess(p, g)) return { ...out, bad: true };
    const key = setKey(g);
    if (seen.has(key)) continue;
    seen.add(key);
    const r = checkGuess(p, s, g);
    if (r.ok) out.solved.push(r.group.level);
    else out.slips++;
  }
  return out;
}

export function verify(p: QuadsPuzzle, s: QuadsSolution, state: QuadsState): VerifyResult {
  const r = replay(p, s, state);
  if (r.bad) return { ok: false, progress: r.solved.length / 4, reason: "malformed or played past the end" };
  if (r.solved.length === 4) return { ok: true, progress: 1 };
  return { ok: false, progress: r.solved.length / 4, reason: r.slips >= SLIPS ? "out of slips" : "incomplete" };
}

export function progress(p: QuadsPuzzle, s: QuadsSolution, state: QuadsState): number {
  return replay(p, s, state).solved.length / 4;
}

/** Points at two words of the most direct unsolved group, without naming the group. */
export function hint(p: QuadsPuzzle, s: QuadsSolution, state: QuadsState): Hint | null {
  const r = replay(p, s, state);
  const g = s.groups.find((x) => !r.solved.includes(x.level));
  if (!g || r.slips >= SLIPS) return null;
  const pair = g.words.slice(0, 2);
  return { target: pair, text: `${pair[0]} and ${pair[1]} belong together.` };
}

const logic: GuessLogic<QuadsPuzzle, QuadsSolution, QuadsState, QuadsGuess, QuadsCheck> = {
  id: "quads",
  contentCount,
  generate,
  generateAt,
  checkGuess,
  verify,
  progress,
  hint,
};
export default logic;
