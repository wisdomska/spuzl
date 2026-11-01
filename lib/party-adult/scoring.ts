/**
 * Scoring for the 18+ party modes. The server computes each round's awards once, when the round closes, and
 * adds them to the room's running points; the podium ranks by points.
 *
 * Draw It: a correct guess scores 50 to 200 by speed (200 at once, 50 at the buzzer); the drawer scores 50
 *   per correct guesser, so a clear drawing pays.
 * Two Truths: spotting the lie scores 100; the writer scores 50 for each player they fooled (anyone who
 *   voted for a true statement). Not voting scores nothing for anyone.
 */
import { normaliseWord, squashWord, type DrawWord } from "./content";

export const DRAW = { guessMax: 200, guessMin: 50, perGuesser: 50 } as const;
export const TRUTHS = { spot: 100, perFooled: 50 } as const;

export function guesserPoints(elapsedMs: number, roundMs: number): number {
  const left = roundMs > 0 ? Math.max(0, Math.min(1, 1 - elapsedMs / roundMs)) : 0;
  return Math.round(DRAW.guessMin + (DRAW.guessMax - DRAW.guessMin) * left);
}

export type Awards = Record<string, number>;

/** Draw It round awards from the correct guesses (each guesser's first correct guess). */
export function drawAwards(drawer: string | null, correct: { playerId: string; elapsedMs: number }[], roundMs: number): Awards {
  const out: Awards = {};
  const seen = new Set<string>();
  for (const g of correct) {
    if (g.playerId === drawer || seen.has(g.playerId)) continue;
    seen.add(g.playerId);
    out[g.playerId] = guesserPoints(g.elapsedMs, roundMs);
  }
  if (drawer && seen.size) out[drawer] = DRAW.perGuesser * seen.size;
  return out;
}

/** Two Truths round awards from the votes (statement index per voter) and the lie's index. */
export function truthsAwards(author: string | null, lie: number, votes: { playerId: string; pick: number }[]): Awards {
  const out: Awards = {};
  let fooled = 0;
  for (const v of votes) {
    if (v.playerId === author) continue;
    if (v.pick === lie) out[v.playerId] = TRUTHS.spot;
    else fooled++;
  }
  if (author && fooled) out[author] = TRUTHS.perFooled * fooled;
  return out;
}

/** Running totals after a round. */
export function addAwards(points: Record<string, number>, awards: Awards): Record<string, number> {
  const out = { ...points };
  for (const [id, n] of Object.entries(awards)) out[id] = (out[id] ?? 0) + n;
  return out;
}

/** Final places: most points first, ties share the place ("1, 1, 3"). */
export function placesOf(points: Record<string, number>): { id: string; points: number; place: number }[] {
  const sorted = Object.entries(points).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted.map(([id, pts]) => ({ id, points: pts, place: sorted.findIndex(([, p]) => p === pts) + 1 }));
}

export type GuessResult = "correct" | "close" | "wrong";

/**
 * Checks a Draw It guess. "close" means the guess contains the answer (or the other way round for long
 * answers), so it is neither scored nor shown to the room (it would give the word away).
 */
export function checkGuess(guess: string, w: DrawWord): GuessResult {
  const g = squashWord(guess);
  if (!g) return "wrong";
  const answers = [w.word, ...(w.alt ?? [])].map(squashWord);
  if (answers.includes(g)) return "correct";
  const main = squashWord(w.word);
  if (g.includes(main) || (g.length >= 4 && main.includes(g))) return "close";
  return "wrong";
}

/** Letters per word of the answer, shown to guessers as blanks ("_ _ _ _ _"). */
export const wordShape = (word: string) =>
  normaliseWord(word)
    .split(" ")
    .map((p) => p.length);
