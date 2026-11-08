/**
 * Draw It for 16+ (R2-P5, party mode "drawfam"). The same rounds as the 18+ Draw It (vector strokes only, wiped when
 * the round closes, reports keep a snapshot), with three differences:
 *   - the words come from a preset family-safe list: since round 3 (item 11) public.family_draw_words, managed on the
 *     admin Content page (./family-words.ts reads it), with FAMILY_DRAW_WORDS below as the seed and the fallback;
 *   - guessers pick the word from four preset options, once per round: nobody types anything in the room;
 *   - the gate is 16+ instead of 18+: the admin switch "party.familyDraw" is on, the player is signed in with an
 *     account (not an anonymous guest), their age band is 16-17 or 18+, and no moderator block is running.
 * Under-16s never see or join it: a drawing can't be filtered before others see it, so the only protection is a
 * report after the fact (docs/DECISIONS.md PD1).
 */
import { DRAW_WORDS, normaliseWord, type DrawWord } from "./content";

/**
 * Words kept out of the family list: fine for adults, but not the light, everyday things this mode is for, or too
 * easy to confuse with another word on the list.
 */
export const NOT_FAMILY: ReadonlySet<string> = new Set(["funeral cloth", "rocket ship"]);

/** The preset word list for 16+ rooms: Draw It's family-safe words (Ghanaian everyday things first). */
export const FAMILY_DRAW_WORDS: readonly DrawWord[] = DRAW_WORDS.filter((w) => !NOT_FAMILY.has(w.word));

/** Options a guesser picks from: the word and three others. */
export const FAMILY_OPTIONS = 4;

/** Every name a word goes by, normalised (the word and its other names). */
const namesOf = (w: DrawWord) => [w.word, ...(w.alt ?? [])].map(normaliseWord);

/**
 * The four options for `word`: it and three other words from the list that share none of its names (so "boat" can't
 * stand in for "canoe"), in an order from `rand` (server randomness: rand(n) is a whole number in [0, n)).
 */
export function familyOptions(word: string, rand: (n: number) => number, list: readonly DrawWord[] = FAMILY_DRAW_WORDS): string[] {
  const entry = list.find((w) => w.word === word) ?? { word };
  const mine = new Set(namesOf(entry));
  const pool = list.filter((w) => w.word !== word && !namesOf(w).some((n) => mine.has(n)));
  const picks: string[] = [];
  while (picks.length < FAMILY_OPTIONS - 1 && pool.length) picks.push(pool.splice(rand(pool.length), 1)[0].word);
  const out = [word, ...picks];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The 16+ gate lives in ./gate.ts (no word list), so client screens can ask it without bundling the words.
export { canSeeFamilyDraw, familyDrawRefusal, type FamilyRefusal } from "./gate";
