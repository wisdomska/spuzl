import { describe, expect, it } from "vitest";
import { CONTENT } from "@/games/quads/content";
import { MAX_PACK, packToJson, parsePack, repeatedWords, setDifficulty, toDraft, type QuadsPayload } from "./quads-pack";

const all = CONTENT as unknown as QuadsPayload[];

describe("Quads packs (admin import and export)", () => {
  it("round-trips every seeded puzzle: export, import, export gives the same file", () => {
    const text = packToJson(all);
    const back = parsePack(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.puzzles).toEqual(all.map((p) => ({ groups: p.groups.map((g) => ({ label: g.label, words: [...g.words] })) })));
    expect(packToJson(back.puzzles)).toBe(text);
    expect(JSON.parse(text)).toMatchObject({ app: "spuzl", kind: "quads", version: 1 });
    expect(JSON.parse(text).puzzles[0].groups.map((g: { difficulty: string }) => g.difficulty)).toEqual([
      "easy",
      "medium",
      "hard",
      "tricky",
    ]);
  });

  it("puts groups in difficulty order, tidies words, and reads a bare content.ts list too", () => {
    const [p] = JSON.parse(packToJson([all[0]])).puzzles;
    const shuffled = {
      app: "spuzl",
      kind: "quads",
      version: 1,
      puzzles: [{ groups: [p.groups[3], p.groups[0], p.groups[2], p.groups[1]] }],
    };
    shuffled.puzzles[0].groups[1] = { ...p.groups[0], words: p.groups[0].words.map((w: string) => ` ${w.toLowerCase()} `) };
    const r = parsePack(JSON.stringify(shuffled));
    expect(r.ok && r.puzzles[0]).toEqual(all[0]);
    const bare = parsePack(JSON.stringify(all.slice(0, 2)));
    expect(bare.ok && bare.puzzles).toEqual(all.slice(0, 2));
  });

  it("lists every problem with its puzzle number and saves nothing", () => {
    expect(parsePack("{")).toEqual({ ok: false, errors: ["Not valid JSON."] });
    expect(parsePack('{"kind":"daily-five"}').ok).toBe(false);
    expect(parsePack("[]")).toEqual({ ok: false, errors: ["The pack has no puzzles."] });
    expect(parsePack(JSON.stringify(Array(MAX_PACK + 1).fill(all[0]))).ok).toBe(false);
    const good = JSON.parse(packToJson([all[0]])).puzzles[0];
    const twoEasy = { groups: good.groups.map((g: object, i: number) => ({ ...g, difficulty: i < 2 ? "easy" : "hard" })) };
    const dupWord = {
      groups: all[1].groups.map((g, i) => (i === 3 ? { ...g, words: [all[1].groups[0].words[0], ...g.words.slice(1)] } : g)),
    };
    const threeGroups = { groups: all[2].groups.slice(0, 3) };
    const shortGroup = { groups: all[3].groups.map((g, i) => (i ? g : { ...g, words: g.words.slice(0, 3) })) };
    const r = parsePack(JSON.stringify([good, twoEasy, dupWord, threeGroups, shortGroup, { nope: 1 }]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.startsWith("Puzzle 1"))).toBe(false);
    for (const n of [2, 3, 4, 5, 6])
      expect(
        r.errors.some((e) => e.startsWith(`Puzzle ${n}:`)),
        `puzzle ${n}`,
      ).toBe(true);
    expect(r.errors.join(" ")).toContain("one group of each difficulty");
    expect(r.errors.join(" ")).toContain("All 16 words must be different");
  });

  it("swaps groups to change difficulty and flags repeated words as you type", () => {
    expect(setDifficulty(["a", "b", "c", "d"], 0, 3)).toEqual(["d", "b", "c", "a"]);
    expect([...repeatedWords({ groups: [{ words: ["Kente", "", "KOKO"] }, { words: ["kente ", "fufu"] }] })]).toEqual(["KENTE"]);
  });

  it("normalises stored payloads for the server export (R4-16) and round-trips them", () => {
    expect(toDraft(null).groups).toHaveLength(4);
    expect(toDraft({ groups: [{ label: 7, words: ["A", 2] }] }).groups[0]).toEqual({ label: "", words: ["A", "", "", ""] });
    const stored = CONTENT.slice(0, 3) as unknown as QuadsPayload[];
    const back = parsePack(packToJson(stored.map(toDraft)));
    expect(back.ok && back.puzzles).toEqual(
      stored.map((p) => ({ groups: p.groups.map((g) => ({ label: g.label, words: [...g.words] })) })),
    );
  });
});
