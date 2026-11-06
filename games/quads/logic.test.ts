import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, { checkGuess, contentCount, generate, generateAt, grade, hint, practice, progress, replay, verify } from "./logic";
import { CONTENT, needsReview } from "./content";
import { PRACTICE_GROUPS, PRACTICE_INDEX } from "./practice";
import { groupCount, SLIPS, validGuess } from "./rules";
import { validatePayload } from "@/lib/admin/content-schemas";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

describe("quads content", () => {
  it("has 30+ curated puzzles of 4 distinct groups of 4 distinct uppercase words that the editor accepts", () => {
    expect(needsReview).toBe(true);
    expect(CONTENT.length).toBeGreaterThanOrEqual(30);
    const labels = new Set<string>();
    for (const e of CONTENT) {
      expect(e.groups).toHaveLength(4);
      const words = e.groups.flatMap((g) => g.words);
      expect(new Set(words).size, e.groups[0].label).toBe(16);
      for (const w of words) expect(w).toMatch(/^[A-Z]{2,12}$/);
      for (const g of e.groups) {
        expect(g.label).not.toMatch(/[–—]/);
        expect(g.label.length).toBeLessThanOrEqual(40);
      }
      labels.add(e.groups.map((g) => g.label).join("|"));
      expect(validatePayload("quads", e).success, e.groups[0].label).toBe(true);
    }
    expect(labels.size, "no puzzle twice").toBe(CONTENT.length);
  });

  it("keeps SPUZL's mix: a Ghanaian or West African group in most puzzles", () => {
    const local = /Ghana|West African|Ananse|Adinkra|Black Stars|Mole|cassava|maize|Sol-fa/i;
    const withLocal = CONTENT.filter((e) => e.groups.some((g) => local.test(g.label)));
    expect(withLocal.length / CONTENT.length).toBeGreaterThanOrEqual(0.4);
  });
});

describe("quads practice round (guided first play)", () => {
  it("is a fixed board of 2 plain groups that verifies like a real one", () => {
    const { puzzle, solution } = practice();
    expect(practice()).toEqual({ puzzle, solution, grade: 0 });
    expect(groupCount(puzzle)).toBe(2);
    expect(puzzle.words).toHaveLength(8);
    expect([...puzzle.words].sort()).toEqual(PRACTICE_GROUPS.flatMap((g) => g.words).sort());
    expect(puzzle.ref).toEqual({ game: "quads", i: PRACTICE_INDEX, d: "easy" });
    expect(PRACTICE_INDEX).toBeGreaterThanOrEqual(contentCount);
    expect(JSON.stringify(puzzle)).not.toContain(PRACTICE_GROUPS[1].label);
    const g = solution.groups;
    expect(checkGuess(puzzle, solution, g[1].words)).toMatchObject({ ok: true, group: { level: 1 } });
    expect(checkGuess(puzzle, solution, [...g[0].words.slice(0, 3), g[1].words[0]])).toEqual({ ok: false, oneAway: true });
    expect(verify(puzzle, solution, { guesses: [g[0].words] })).toMatchObject({ ok: false, progress: 0.5 });
    expect(verify(puzzle, solution, { guesses: [g[1].words, g[0].words] })).toEqual({ ok: true, progress: 1 });
    // Nothing after the last group.
    expect(verify(puzzle, solution, { guesses: [g[1].words, g[0].words, g[0].words] }).ok).toBe(false);
    expect(hint(puzzle, solution, { guesses: [] })!.target).toEqual(g[0].words.slice(0, 2));
    expect(logic.practice).toBe(practice);
  });
});

describe("quads generator", () => {
  it("is deterministic and never sends groups or labels to the client", () => {
    for (const d of DIFFS) {
      const a = generateAt(5, d);
      expect(generateAt(5, d)).toEqual(a);
      expect(a.puzzle.words).toHaveLength(16);
      expect(a.puzzle).not.toHaveProperty("groups");
      const json = JSON.stringify(a.puzzle);
      for (const g of a.solution.groups.slice(d === "easy" ? 1 : 0)) expect(json).not.toContain(g.label);
    }
    expect(generateAt(0, "easy").puzzle.starter).toBe(CONTENT[0].groups[0].label);
    expect(generateAt(contentCount, "medium").solution).toEqual(generateAt(0, "medium").solution);
    expect(generateAt(-1, "medium").solution.groups[0].label).toBe(CONTENT[contentCount - 1].groups[0].label);
    expect(generate(createRng("s"), "hard")).toEqual(generate(createRng("s"), "hard"));
  });

  it("grades monotonically across difficulties for the same entry", () => {
    for (let i = 0; i < 25; i++) {
      const gs = DIFFS.map((d) => generateAt(i, d).grade);
      for (let k = 1; k < gs.length; k++) expect(gs[k]).toBeGreaterThan(gs[k - 1]);
    }
    expect(grade(0, "mega", ["A".repeat(40)])).toBeLessThanOrEqual(100);
  });
});

describe("quads guesses and verification", () => {
  const { puzzle, solution } = generateAt(0, "medium");
  const g = solution.groups;

  it("checks a set of four", () => {
    expect(checkGuess(puzzle, solution, g[2].words.slice().reverse())).toEqual({ ok: true, group: { ...g[2], words: g[2].words } });
    const oneAway = [...g[0].words.slice(0, 3), g[1].words[0]];
    expect(checkGuess(puzzle, solution, oneAway)).toEqual({ ok: false, oneAway: true });
    const twoTwo = [...g[0].words.slice(0, 2), ...g[1].words.slice(0, 2)];
    expect(checkGuess(puzzle, solution, twoTwo)).toEqual({ ok: false, oneAway: false });
    expect(checkGuess(puzzle, solution, ["NOPE", ...g[0].words.slice(0, 3)])).toMatchObject({ invalid: true });
    expect(checkGuess(puzzle, solution, [g[0].words[0], g[0].words[0], g[0].words[1], g[0].words[2]])).toMatchObject({ invalid: true });
    expect(validGuess(puzzle, "x")).toBe(false);
  });

  it("verifies a clear with slips, rejects a fifth slip, play past the end and junk", () => {
    const wrong = [...g[0].words.slice(0, 2), ...g[1].words.slice(0, 2)];
    const clean = { guesses: g.map((x) => x.words) };
    expect(verify(puzzle, solution, clean)).toEqual({ ok: true, progress: 1 });
    const withSlips = { guesses: [wrong, wrong, g[0].words, g[1].words, g[2].words, g[3].words] };
    expect(verify(puzzle, solution, withSlips).ok).toBe(true);
    expect(replay(puzzle, solution, withSlips).slips).toBe(1);
    const wrongs = [0, 1, 2, 3].map((k) => [g[0].words[k], g[1].words[k], g[2].words[k], g[3].words[k]]);
    const out = { guesses: [...wrongs, g[0].words] };
    const r = verify(puzzle, solution, out);
    expect(r.ok).toBe(false);
    expect(verify(puzzle, solution, { guesses: wrongs })).toMatchObject({ ok: false, reason: "out of slips" });
    expect(verify(puzzle, solution, { guesses: [...g.map((x) => x.words), wrong] }).ok).toBe(false);
    expect(verify(puzzle, solution, { guesses: [["A"]] }).ok).toBe(false);
    expect(verify(puzzle, solution, null as unknown as { guesses: string[][] }).ok).toBe(false);
    expect(verify(puzzle, solution, { guesses: [g[0].words] })).toMatchObject({ ok: false, progress: 0.25 });
    expect(progress(puzzle, solution, { guesses: [g[1].words, g[3].words] })).toBe(0.5);
    expect(SLIPS).toBe(4);
  });

  it("hints pair two words of the most direct open group without naming it", () => {
    const h = hint(puzzle, solution, { guesses: [] })!;
    expect(h.target).toEqual(g[0].words.slice(0, 2));
    expect(h.text).not.toContain(g[0].label);
    expect((hint(puzzle, solution, { guesses: [g[0].words] })!.target as string[])[0]).toBe(g[1].words[0]);
    expect(hint(puzzle, solution, { guesses: g.map((x) => x.words) })).toBeNull();
    const wrongs = [0, 1, 2, 3].map((k) => [g[0].words[k], g[1].words[k], g[2].words[k], g[3].words[k]]);
    expect(hint(puzzle, solution, { guesses: wrongs })).toBeNull();
    expect(logic.id).toBe("quads");
  });
});
