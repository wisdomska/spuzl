import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { RoomCreateInput } from "@/lib/multiplayer/roomInput";
import { DEFAULTS } from "@/lib/game-settings/schema";
import { partyTextProblem } from "./filter";
import { normaliseWord } from "./content";
import { canSeeFamilyDraw, FAMILY_DRAW_WORDS, FAMILY_OPTIONS, familyDrawRefusal, familyOptions, NOT_FAMILY } from "./family";
import { isAdultMode, isFamilyDraw, isTurnMode, roundModeOf } from "./modes";

const randOf = (seed: string) => {
  const rng = createRng(seed);
  return (n: number) => rng.int(0, n - 1);
};

describe("Family Draw words (R2-P5)", () => {
  it("are preset, unique and pass the strict text filter (word filter on), with Ghanaian everyday things", () => {
    expect(FAMILY_DRAW_WORDS.length).toBeGreaterThanOrEqual(80);
    const words = FAMILY_DRAW_WORDS.map((w) => w.word);
    expect(new Set(words).size).toBe(words.length);
    for (const w of FAMILY_DRAW_WORDS)
      for (const a of [w.word, ...(w.alt ?? [])]) expect(partyTextProblem(a, "guess", { words: true }), a).toBeNull();
    for (const w of ["banku", "kente", "trotro", "jollof"]) expect(words).toContain(w);
    for (const w of NOT_FAMILY) expect(words).not.toContain(w);
  });

  it("offer four options: the word and three others that share none of its names, in a random order", () => {
    const spots = new Set<number>();
    for (const [k, w] of FAMILY_DRAW_WORDS.entries()) {
      const o = familyOptions(w.word, randOf(`opt:${k}`));
      expect(o).toHaveLength(FAMILY_OPTIONS);
      expect(new Set(o).size).toBe(FAMILY_OPTIONS);
      expect(o).toContain(w.word);
      spots.add(o.indexOf(w.word));
      const mine = new Set([w.word, ...(w.alt ?? [])].map(normaliseWord));
      for (const other of o.filter((x) => x !== w.word)) {
        const e = FAMILY_DRAW_WORDS.find((x) => x.word === other)!;
        expect(
          [e.word, ...(e.alt ?? [])].some((n) => mine.has(normaliseWord(n))),
          `${w.word} vs ${other}`,
        ).toBe(false);
      }
    }
    expect([...spots].sort()).toEqual([0, 1, 2, 3]);
    // the options fit the database check (four words, 160 characters in all)
    expect(Math.max(...FAMILY_DRAW_WORDS.map((w) => w.word.length)) * 4).toBeLessThanOrEqual(160);
  });
});

describe("Family Draw gate: 16+, signed in, switched on, not blocked", () => {
  const now = Date.parse("2026-12-01T00:00:00Z");
  it("refuses under-16s, guests and everyone while off; lets 16-17 and 18+ in", () => {
    expect(familyDrawRefusal({ ageBand: "16-17", guest: false }, false, now)).toBe("family_draw_off");
    expect(familyDrawRefusal({ ageBand: "18+", guest: true }, true, now)).toBe("family_signed_in");
    expect(familyDrawRefusal({ ageBand: "13-15", guest: false }, true, now)).toBe("family_16_plus");
    expect(familyDrawRefusal({ ageBand: null, guest: false }, true, now)).toBe("family_16_plus");
    expect(familyDrawRefusal({ ageBand: "16-17", guest: false }, true, now)).toBeNull();
    expect(familyDrawRefusal({ ageBand: "18+", guest: false }, true, now)).toBeNull();
    expect(familyDrawRefusal({ ageBand: "18+", guest: false, blockedUntil: "2026-12-02T00:00:00Z" }, true, now)).toBe(
      "adult_party_blocked",
    );
    expect(familyDrawRefusal({ ageBand: "18+", guest: false, blockedUntil: "2026-11-30T00:00:00Z" }, true, now)).toBeNull();
  });

  it("the client hides it from under-16s and guests, and the setting ships off", () => {
    expect(DEFAULTS["party.familyDraw"]).toBe(false);
    expect(canSeeFamilyDraw({ age_band: "13-15", guest: false }, true)).toBe(false);
    expect(canSeeFamilyDraw({ age_band: "16-17", guest: true }, true)).toBe(false);
    expect(canSeeFamilyDraw({ age_band: "16-17" }, true)).toBe(false); // unknown guest flag counts as a guest
    expect(canSeeFamilyDraw({ age_band: "16-17", guest: false }, true)).toBe(true);
    expect(canSeeFamilyDraw(null, true)).toBe(false);
  });

  it("is a turn mode that plays Draw It rounds, and not an 18+ mode", () => {
    expect(isTurnMode("drawfam")).toBe(true);
    expect(isAdultMode("drawfam")).toBe(false);
    expect(isFamilyDraw("drawfam")).toBe(true);
    expect(roundModeOf("drawfam")).toBe("draw");
    expect(roundModeOf("truths")).toBe("truths");
    expect(isTurnMode("race")).toBe(false);
    expect(RoomCreateInput.parse({ mode: "drawfam", maxPlayers: 4 }).mode).toBe("drawfam");
  });
});
