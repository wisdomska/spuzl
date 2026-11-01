import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, { checkGuess, contentCount, generate, generateAt, grade, hint, progress, replay, scoreOf, verify } from "./logic";
import { CONTENT, needsReview } from "./content";
import { LIMIT_MS, OPTIONS, READ_FLOOR_MS, ROUNDS, titleKey, titleMatches, TRIES, type EmojiState, type RoundLog } from "./rules";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** A clean run: every title typed right on the first try. */
const clean = (titles: string[], ms = 5000): EmojiState => ({ rounds: titles.map((t) => ({ tries: [t], ms })) });

describe("emoji hits content", () => {
  it("has ~80+ distinct, family-safe title entries with a mix of global and Ghanaian or African hits", () => {
    expect(needsReview).toBe(true);
    expect(CONTENT.length).toBeGreaterThanOrEqual(80);
    // packs of five never repeat a start before the pool wraps
    expect(gcd(CONTENT.length, ROUNDS)).toBe(1);
    const keys = CONTENT.map((e) => titleKey(e.title));
    expect(new Set(keys).size).toBe(keys.length);
    const local = CONTENT.filter((e) => e.from !== "world").length;
    expect(local).toBeGreaterThanOrEqual(25);
    expect(CONTENT.filter((e) => e.from === "ghana").length).toBeGreaterThanOrEqual(8);
    for (const kind of ["song", "film", "tv"] as const)
      expect(CONTENT.filter((e) => e.kind === kind).length).toBeGreaterThanOrEqual(OPTIONS);
    for (const e of CONTENT) {
      expect(e.emoji.length, e.title).toBeGreaterThan(0);
      // the clue is emoji only: no letters or digits that could spell the title
      expect(e.emoji, e.title).not.toMatch(/[A-Za-z0-9]/);
      expect(e.clue ?? `${e.by}${e.year}`, e.title).not.toMatch(/undefined/);
      if (e.year) expect(e.year).toBeGreaterThan(1900);
      // no title is so close to another that a typo would count for both
      for (const o of CONTENT)
        if (o !== e) expect(titleMatches(o.title, [e.title, ...(e.accept ?? [])]), `${o.title} vs ${e.title}`).toBe(false);
    }
  });
});

describe("emoji hits matching", () => {
  it("forgives case, punctuation, accents, spacing and a leading 'the'", () => {
    expect(titleMatches("lion king", ["The Lion King"])).toBe(true);
    expect(titleMatches("THE LION-KING!", ["The Lion King"])).toBe(true);
    expect(titleMatches("pokemon", ["Pokémon"])).toBe(true);
    expect(titleMatches("Mr Bean", ["Mr. Bean"])).toBe(true);
    expect(titleMatches("spiderman", ["Spider-Man"])).toBe(true);
    expect(titleMatches("wavin flag", ["Wavin' Flag"])).toBe(true);
    expect(titleMatches("Beauty & the Beast", ["Beauty and the Beast"])).toBe(true);
    expect(titleMatches("Iwaju", ["Iwájú"])).toBe(true);
    // a small typo on a longer title is fine, a different title is not
    expect(titleMatches("Jurasic Park", ["Jurassic Park"])).toBe(true);
    expect(titleMatches("Hello", ["Yellow"])).toBe(false);
    expect(titleMatches("Up", ["Cars"])).toBe(false);
    expect(titleMatches("", ["Up"])).toBe(false);
    expect(titleMatches("the", ["The Lion King"])).toBe(false);
  });
});

describe("emoji hits generator", () => {
  it("is deterministic, never ships titles, and offers four options only on easy", () => {
    for (const d of DIFFS) {
      for (let s = 0; s < 25; s++) {
        const g = generate(createRng(`seed-${s}`), d);
        expect(generate(createRng(`seed-${s}`), d)).toEqual(g);
        expect(generateAt(g.puzzle.ref.i, d)).toEqual(g);
        expect(g.puzzle.rounds).toHaveLength(ROUNDS);
        expect(g.grade).toBeGreaterThanOrEqual(0);
        expect(g.grade).toBeLessThanOrEqual(100);
        const json = JSON.stringify({ ...g.puzzle, rounds: g.puzzle.rounds.map((r) => ({ ...r, options: undefined })) });
        for (const a of g.solution.answers) expect(json).not.toContain(a[0]);
        g.puzzle.rounds.forEach((r, k) => {
          expect(r.words).toBe(g.solution.answers[k][0].split(" ").length);
          if (d === "easy") {
            expect(r.options).toHaveLength(OPTIONS);
            expect(new Set(r.options).size).toBe(OPTIONS);
            expect(r.options!.filter((o) => titleMatches(o, g.solution.answers[k]))).toHaveLength(1);
          } else expect(r.options).toBeUndefined();
        });
      }
    }
  });

  it("never repeats a title on consecutive days and wraps the index", () => {
    for (let i = 0; i < contentCount; i++) {
      const a = generateAt(i, "medium").solution.answers.map((x) => x[0]);
      const b = generateAt(i + 1, "medium").solution.answers.map((x) => x[0]);
      expect(a.filter((x) => b.includes(x))).toEqual([]);
    }
    expect(generateAt(contentCount, "hard").solution).toEqual(generateAt(0, "hard").solution);
    expect(generateAt(-1, "hard").solution).toEqual(generateAt(contentCount - 1, "hard").solution);
  });

  it("grades harder days higher for the same pack", () => {
    for (let i = 0; i < 20; i++) {
      const gs = DIFFS.map((d) => generateAt(i, d).grade);
      for (let k = 1; k < gs.length; k++) expect(gs[k]).toBeGreaterThan(gs[k - 1]);
    }
    expect(grade(CONTENT.slice(0, 5), "mega")).toBeLessThanOrEqual(100);
  });
});

describe("emoji hits guesses and verification", () => {
  for (const d of DIFFS) {
    it(`verifies finished runs and rejects malformed ones (${d})`, () => {
      for (let s = 0; s < 20; s++) {
        const { puzzle, solution } = generate(createRng(`v-${d}-${s}`), d);
        const titles = solution.answers.map((a) => a[0]);
        const perfect = verify(puzzle, solution, clean(titles));
        expect(perfect.ok).toBe(true);
        expect(perfect.score).toBe(ROUNDS * (100 + Math.round((50 * (LIMIT_MS - 5000)) / LIMIT_MS)));
        // slower and sloppier scores less; all wrong still finishes, with 0
        const slow = verify(puzzle, solution, clean(titles, LIMIT_MS)).score!;
        expect(slow).toBeLessThan(perfect.score!);
        const sloppy: EmojiState = { rounds: titles.map((t) => ({ tries: ["nope", "still nope", t], ms: 5000 })) };
        expect(verify(puzzle, solution, sloppy).score!).toBeLessThan(perfect.score!);
        const lost: EmojiState = { rounds: titles.map(() => ({ tries: ["nope", "no", "nah"], ms: 9000 })) };
        expect(verify(puzzle, solution, lost)).toEqual({ ok: true, progress: 1, score: 0 });
        const skipped: EmojiState = { rounds: titles.map(() => ({ tries: [], ms: LIMIT_MS })) };
        expect(verify(puzzle, solution, skipped).score).toBe(0);
        // malformed or implausible logs are refused
        expect(verify(puzzle, solution, { rounds: clean(titles).rounds.slice(0, 3) })).toMatchObject({ ok: false, progress: 3 / 5 });
        expect(verify(puzzle, solution, { rounds: [...clean(titles).rounds, { tries: [], ms: 1 }] }).ok).toBe(false);
        expect(verify(puzzle, solution, { rounds: titles.map((t) => ({ tries: [t, t], ms: 5000 })) }).ok).toBe(false);
        expect(verify(puzzle, solution, { rounds: titles.map((t) => ({ tries: ["a", "b", "c", t], ms: 5000 })) }).ok).toBe(false);
        expect(verify(puzzle, solution, clean(titles, READ_FLOOR_MS - 1)).ok).toBe(false);
        expect(verify(puzzle, solution, clean(titles, LIMIT_MS + 1)).ok).toBe(false);
        expect(verify(puzzle, solution, null as unknown as EmojiState).ok).toBe(false);
        expect(verify(puzzle, solution, { rounds: [{ tries: [{}], ms: 5000 } as unknown as RoundLog] }).ok).toBe(false);
        expect(progress(puzzle, solution, { rounds: clean(titles).rounds.slice(0, 2) })).toBe(0.4);
        if (d === "easy") {
          const picks: EmojiState = {
            rounds: puzzle.rounds.map((r, k) => ({ tries: [r.options!.indexOf(titles[k])], ms: 5000 })),
          };
          expect(verify(puzzle, solution, picks)).toEqual(perfect);
        } else {
          expect(verify(puzzle, solution, { rounds: titles.map(() => ({ tries: [0], ms: 5000 })) }).ok).toBe(false);
        }
      }
    });
  }

  it("checks one try at a time and reveals a title only when asked", () => {
    const { puzzle, solution } = generateAt(4, "easy");
    const title = solution.answers[0][0];
    expect(checkGuess(puzzle, solution, { round: 0, answer: title.toLowerCase() })).toEqual({ ok: true, title });
    expect(checkGuess(puzzle, solution, { round: 0, answer: "definitely not it" })).toEqual({ ok: false });
    expect(checkGuess(puzzle, solution, { round: 0, answer: puzzle.rounds[0].options!.indexOf(title) })).toEqual({ ok: true, title });
    expect(checkGuess(puzzle, solution, { round: 0, answer: 9 })).toMatchObject({ invalid: true });
    expect(checkGuess(puzzle, solution, { round: 7, answer: title })).toMatchObject({ invalid: true });
    expect(checkGuess(puzzle, solution, { round: 0, answer: "" })).toMatchObject({ invalid: true });
    expect(checkGuess(puzzle, solution, null as never)).toMatchObject({ invalid: true });
    expect(checkGuess(puzzle, solution, { round: 2, reveal: true })).toEqual({ reveal: solution.answers[2][0] });
    const hard = generateAt(4, "hard");
    expect(checkGuess(hard.puzzle, hard.solution, { round: 0, answer: 0 })).toMatchObject({ invalid: true });
  });

  it("hints name the maker and year of the round in play, never the title", () => {
    for (let s = 0; s < 20; s++) {
      const { puzzle, solution } = generate(createRng(`h-${s}`), "medium");
      const titles = solution.answers.map((a) => a[0]);
      for (let r = 0; r < ROUNDS; r++) {
        const h = hint(puzzle, solution, { rounds: clean(titles).rounds.slice(0, r) })!;
        expect(h.target).toEqual({ round: r });
        expect(h.text.length).toBeGreaterThan(5);
        expect(titleKey(h.text)).not.toContain(titleKey(titles[r]));
      }
      expect(hint(puzzle, solution, undefined as unknown as EmojiState)!.target).toEqual({ round: 0 });
      expect(hint(puzzle, solution, clean(titles))).toBeNull();
    }
    expect(scoreOf(replay(generateAt(0, "easy").puzzle, generateAt(0, "easy").solution, { rounds: [] })!, LIMIT_MS)).toEqual({
      score: 0,
      right: 0,
    });
    expect(TRIES).toBe(3);
    expect(logic.id).toBe("emojihits");
  });
});
