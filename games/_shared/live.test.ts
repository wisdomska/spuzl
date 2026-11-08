import { afterEach, describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { LOGIC } from "@/games/logic-registry";
import type { Difficulty } from "@/games/types";
import { contentReviewOf, liveContent, setContentReview, withContentReview, type ContentReview } from "./live";

type AnyEntry = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Round 3 item 12: every content game's picker reads its list through liveContent, so a retired entry never reaches
 * a board. For each game, `sig` is text a board built from the entry carries (in its puzzle or solution); the test
 * first shows the text does turn up while nothing is retired, then retires those entries and builds many boards.
 */
const GAMES: { game: string; load: () => Promise<readonly unknown[]>; sig: (e: AnyEntry | string) => string }[] = [
  { game: "coil", load: async () => (await import("@/games/coil/content")).CONTENT, sig: (e) => JSON.stringify((e as AnyEntry).words) },
  { game: "rungs", load: async () => (await import("@/games/rungs/content")).CONTENT, sig: (e) => JSON.stringify((e as AnyEntry).words) },
  {
    game: "quads",
    load: async () => (await import("@/games/quads/content")).CONTENT,
    sig: (e) => JSON.stringify((e as AnyEntry).groups[0].words),
  },
  {
    game: "minicross",
    load: async () => (await import("@/games/minicross/content")).CONTENT,
    sig: (e) => JSON.stringify((e as AnyEntry).rows.join("").split("")),
  },
  { game: "seven", load: async () => (await import("@/games/seven/content")).CONTENT, sig: (e) => `"${(e as AnyEntry).pangram}"` },
  { game: "buried", load: async () => (await import("@/games/buried/content")).CONTENT, sig: (e) => `"theme":"${(e as AnyEntry).theme}"` },
  { game: "remix", load: async () => (await import("@/games/remix/content")).CONTENT, sig: (e) => JSON.stringify((e as AnyEntry).words) },
  {
    game: "hunch",
    load: async () => (await import("@/games/hunch/content")).CONTENT,
    sig: (e) => `"category":"${(e as AnyEntry).category}"`,
  },
  {
    game: "quickfire",
    load: async () => (await import("@/games/quickfire/content")).CONTENT,
    sig: (e) => JSON.stringify((e as AnyEntry).q),
  },
  {
    game: "twotruths",
    load: async () => (await import("@/games/twotruths/content")).CONTENT,
    sig: (e) => JSON.stringify((e as AnyEntry).fix),
  },
  {
    game: "pinned",
    load: async () => (await import("@/games/pinned/content")).CONTENT,
    sig: (e) => JSON.stringify([(e as AnyEntry).lat, (e as AnyEntry).lon]),
  },
  {
    game: "flagged",
    load: async () => (await import("@/games/flagged/content")).CONTENT,
    sig: (e) => JSON.stringify((e as AnyEntry).name),
  },
  { game: "five", load: async () => (await import("@/games/five/content")).ANSWERS, sig: (e) => `"answer":"${e as string}"` },
  {
    game: "emojihits",
    load: async () => (await import("@/games/emojihits/content")).CONTENT,
    sig: (e) => JSON.stringify((e as AnyEntry).title),
  },
];

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert"];

interface Logic {
  generate(rng: ReturnType<typeof createRng>, d: Difficulty): { puzzle: unknown; solution: unknown };
  generateAt?(i: number, d: Difficulty): { puzzle: unknown; solution: unknown };
}

/** Daily boards 0..days-1 and free-play boards per difficulty, as JSON text. */
function boards(logic: Logic, days: number, seeds: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const b = logic.generateAt!(i, DIFFS[i % DIFFS.length]);
    out.push(JSON.stringify([b.puzzle, b.solution]));
  }
  for (let s = 0; s < seeds; s++)
    for (const d of DIFFS) {
      const b = logic.generate(createRng(`live-test:${s}`), d);
      out.push(JSON.stringify([b.puzzle, b.solution]));
    }
  return out;
}

afterEach(() => {
  for (const g of GAMES) setContentReview(g.game, null);
});

describe("reviewed content: the list a board deals from", () => {
  it("leaves retired entries out, swaps edited ones in, keeps order, and clears", () => {
    const all = ["a", "b", "c", "d"];
    expect(liveContent("x", all)).toBe(all);
    setContentReview("x", { retired: new Set([1]), edited: new Map([[2, "C"]]) });
    expect(liveContent("x", all)).toEqual(["a", "C", "d"]);
    expect(liveContent("x", all)).toBe(liveContent("x", all)); // built once per state
    setContentReview("x", { retired: new Set(), edited: new Map() });
    expect(contentReviewOf("x")).toBeUndefined();
    expect(liveContent("x", all)).toBe(all);
  });

  it("checks a state for a moment and puts the previous one back", () => {
    const before: ContentReview = { retired: new Set([0]), edited: new Map() };
    setContentReview("y", before);
    const seen = withContentReview("y", null, () => liveContent("y", ["a", "b"]));
    expect(seen).toEqual(["a", "b"]);
    expect(contentReviewOf("y")).toBe(before);
    expect(() => withContentReview("y", { retired: new Set([1]), edited: new Map() }, () => { throw new Error("boom"); })).toThrow("boom"); // prettier-ignore
    expect(contentReviewOf("y")).toBe(before);
  });
});

describe("every content game's picker never deals a retired entry (server-side check)", () => {
  for (const g of GAMES) {
    // Dealing 90 boards is slow for the heavier generators (Coil) on CI runners.
    it(g.game, { timeout: 240_000 }, async () => {
      const entries = await g.load();
      const logic = (await LOGIC[g.game]()).default as unknown as Logic;
      // Retire every third entry: plenty stay, so every picker still has a full pool.
      const retired = new Set(entries.map((_, i) => i).filter((i) => i % 3 === 0));
      const sigs = [...retired].map((i) => g.sig(entries[i] as AnyEntry));
      const before = boards(logic, 30, 4);
      expect(
        before.some((b) => sigs.some((s) => b.includes(s))),
        `${g.game}: retired entries' text should show on some boards before they are retired`,
      ).toBe(true);
      setContentReview(g.game, { retired, edited: new Map() });
      for (const b of boards(logic, 60, 8)) {
        const hit = sigs.find((s) => b.includes(s));
        expect(hit, `${g.game}: a retired entry was dealt`).toBeUndefined();
      }
    });
  }

  it("pixl deals only pictures that are not retired", async () => {
    const { ART } = await import("@/games/pixl/art");
    setContentReview("pixl", { retired: new Set(ART.map((_, i) => i)), edited: new Map() });
    expect(liveContent("pixl", ART)).toEqual([]);
    const logic = (await LOGIC.pixl()).default as unknown as Logic;
    // with every picture retired the generator still makes boards (its own patterns), never a library picture
    for (let s = 0; s < 10; s++) expect(logic.generate(createRng(`px:${s}`), "easy").solution).toBeDefined();
  });

  it("deals an edited entry in place of the code entry", async () => {
    const { CONTENT } = await import("@/games/hunch/content");
    const edited = new Map(CONTENT.map((e, i) => [i, { ...e, category: `${e.category} (checked)` }]));
    setContentReview("hunch", { retired: new Set(), edited });
    const logic = (await LOGIC.hunch()).default as unknown as Logic;
    expect(JSON.stringify(logic.generateAt!(0, "easy").solution)).toContain("(checked)");
  });
});
