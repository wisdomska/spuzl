import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { closeEnough, levenshtein, normaliseGuess, packCount, rotation, seal, unseal } from "@/games/_shared/cluecave";
import logic, {
  CLUES,
  contentCount,
  generate,
  generateAt,
  gradeOf,
  hint,
  judge,
  MAX_GUESSES,
  scoreFor,
  sealKey,
  verify,
  type HunchSealed,
} from "./logic";
import { CONTENT, needsReview } from "./content";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

describe("hunch content", () => {
  it("has at least 60 days of sets with 5 clues and no dashes", () => {
    expect(needsReview).toBe(true);
    expect(CONTENT.length).toBeGreaterThanOrEqual(60);
    expect(new Set(CONTENT.map((s) => s.id)).size).toBe(CONTENT.length);
    for (const s of CONTENT) {
      expect(s.clues).toHaveLength(5);
      expect(s.accept.length).toBeGreaterThan(0);
      for (const t of [s.category, ...s.clues]) {
        expect(t).not.toMatch(/[–—]/);
        expect(t.length).toBeLessThanOrEqual(34);
      }
    }
  });

  it("every set accepts its own category name and rejects other categories", () => {
    for (const s of CONTENT) {
      expect(judge(s.category, s.accept, s.warm)).toBe("right");
      for (const a of s.accept) expect(judge(a, s.accept, s.warm)).toBe("right");
      // no set is answered by a clue on its own
      for (const c of s.clues) expect(judge(c, s.accept, s.warm), `${s.id}: ${c}`).not.toBe("right");
    }
  });
});

describe("hunch matching", () => {
  const crown = CONTENT.find((s) => s.id === "crown")!;
  it("fuzzy matches plurals, filler words and small typos", () => {
    expect(judge("things with a crown", crown.accept, crown.warm)).toBe("right");
    expect(judge("Crowns", crown.accept, crown.warm)).toBe("right");
    expect(judge("crwon", crown.accept, crown.warm)).toBe("right");
    expect(judge("stuff that has crowns on top", crown.accept, crown.warm)).toBe("right");
    expect(judge("big shiny gold crowns", crown.accept, crown.warm)).toBe("warm");
    expect(judge("royal stuff", crown.accept, crown.warm)).toBe("warm");
    expect(judge("fruit", crown.accept, crown.warm)).toBe("cold");
    expect(judge("   ", crown.accept, crown.warm)).toBe("cold");
    expect(judge("the", crown.accept, crown.warm)).toBe("cold");
  });
  it("normalises accents, plurals and punctuation", () => {
    expect(normaliseGuess("Lomé's  Cities!")).toEqual(["lome", "city"]);
    expect(normaliseGuess("boxes and glasses")).toEqual(["box", "glass"]);
    expect(normaliseGuess("bus")).toEqual(["bus"]);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(closeEnough("cat", "car")).toBe(false);
    expect(closeEnough("planet", "planit")).toBe(true);
    expect(closeEnough("gemstones", "gemstnes")).toBe(true);
  });
  it("ignores empty accept entries", () => {
    expect(judge("crown", ["the", "crown"], [])).toBe("right");
  });
});

describe("hunch generation", () => {
  it("is deterministic and never repeats on consecutive days", () => {
    expect(contentCount).toBe(CONTENT.length);
    for (let i = 0; i < 90; i++) {
      const a = generateAt(i);
      expect(generateAt(i)).toEqual(a);
      expect(generateAt(i + 1).solution.category).not.toBe(a.solution.category);
    }
    const seen = new Set(Array.from({ length: contentCount }, (_, i) => generateAt(i).solution.category));
    expect(seen.size).toBe(contentCount);
  });

  it("free play is deterministic per seed and respects tiers", () => {
    for (const d of D) {
      for (let k = 0; k < 20; k++) {
        const a = generate(createRng(`free:${d}:${k}`), d);
        expect(generate(createRng(`free:${d}:${k}`), d)).toEqual(a);
        expect(a.grade).toBeGreaterThanOrEqual(0);
        expect(a.grade).toBeLessThanOrEqual(100);
      }
    }
  });

  it("grades harder difficulties higher on average", () => {
    const avg = (d: Difficulty) => {
      let t = 0;
      for (let k = 0; k < 40; k++) t += generate(createRng(`g:${k}`), d).grade;
      return t / 40;
    };
    expect(avg("easy")).toBeLessThan(avg("medium"));
    expect(avg("medium")).toBeLessThan(avg("hard"));
    expect(avg("hard")).toBeLessThanOrEqual(avg("expert"));
    expect(gradeOf(CONTENT[0])).toBeGreaterThan(0);
  });

  it("ships only the first clue in plain text; the rest is sealed", () => {
    const g = generateAt(3);
    const json = JSON.stringify(g.puzzle);
    expect(json).not.toContain(g.solution.category);
    const s = unseal<HunchSealed>(g.puzzle.sealed, sealKey(g.puzzle.ref));
    expect(s.category).toBe(g.solution.category);
    expect(s.more).toHaveLength(CLUES - 1);
    expect(unseal(seal({ a: "Lomé" }, "k"), "k")).toEqual({ a: "Lomé" });
  });

  it("rotation helpers validate their pool", () => {
    expect(() => rotation(3, 2, 0, "x")).toThrow();
    expect(packCount(160, 5)).toBe(32);
    expect(rotation(10, 2, -1, "x")).toHaveLength(2);
  });
});

describe("hunch verify", () => {
  const g = generateAt(0);
  const right = g.solution.accept[0];

  it("accepts a correct final guess and scores by clues and misses", () => {
    expect(verify(g.puzzle, g.solution, { opened: 1, guesses: [right] })).toEqual({ ok: true, progress: 1, score: 100 });
    expect(verify(g.puzzle, g.solution, { opened: 3, guesses: ["zzz", right] })).toEqual({ ok: true, progress: 1, score: 55 });
    expect(verify(g.puzzle, g.solution, { opened: 5, guesses: ["a", "b", "c", "d", "e", right] }).score).toBe(10);
    expect(scoreFor(2, 0)).toBe(80);
  });

  it("rejects near misses and malformed state", () => {
    expect(verify(g.puzzle, g.solution, { opened: 1, guesses: ["zzz"] }).reason).toBe("unsolved");
    expect(verify(g.puzzle, g.solution, { opened: 1, guesses: Array(MAX_GUESSES).fill("zzz") }).reason).toBe("out of guesses");
    expect(verify(g.puzzle, g.solution, { opened: 1, guesses: [right, "zzz"] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { opened: 0, guesses: [right] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { opened: 6, guesses: [right] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { opened: 1.5, guesses: [right] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { opened: 1, guesses: Array(MAX_GUESSES + 1).fill(right) }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { opened: 1, guesses: [3 as unknown as string] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { opened: 1, guesses: ["x".repeat(81)] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as never).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { opened: 1 } as never).ok).toBe(false);
  });

  it("progress is all or nothing", () => {
    expect(logic.progress(g.puzzle, g.solution, { opened: 4, guesses: ["zzz"] })).toBe(0);
    expect(logic.progress(g.puzzle, g.solution, { opened: 4, guesses: [right] })).toBe(1);
  });

  it("hints are safe: a letter and a length, never the word", () => {
    const h = hint(g.puzzle, g.solution, { opened: 1, guesses: [] })!;
    expect(h.text).toMatch(/starts with [A-Z] and has \d+ letters/);
    expect(h.text.toLowerCase()).not.toContain(right.toLowerCase());
    expect(hint(g.puzzle, g.solution, { opened: 1, guesses: [right] })).toBeNull();
    expect(hint(g.puzzle, g.solution, { opened: 9, guesses: [] })).toBeNull();
  });
});
