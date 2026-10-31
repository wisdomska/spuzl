/**
 * Payload schemas for human-written content (content_items.payload), one per game, matching the entry
 * types in games/<id>/content.ts. Used by the editor for live validation and by the server as the gate.
 * Copy rule from the brief applies: no em or en dashes in player-facing text.
 */
import { z } from "zod";

const noDash = (s: string) => !/[–—]/.test(s);
const text = (max = 200) => z.string().trim().min(1).max(max).refine(noDash, "No em or en dashes");
const WORD = /^[A-Z]+$/;
const word = (min = 2, max = 15) =>
  z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().min(min).max(max).regex(WORD, "Letters A to Z only"));

export const CONTENT_SCHEMAS = {
  coil: z
    .object({ theme: text(40), words: z.array(word(4, 12)).min(3).max(9) })
    .refine((e) => e.words.join("").length === 30, { message: "Words must use exactly 30 letters (the 6 x 5 grid)", path: ["words"] }),
  rungs: z
    .object({ words: z.array(word(4, 4)).length(7), clues: z.array(text(80)).length(7) })
    .refine(
      (e) =>
        e.words.every((w, i) => i === 0 || [...w].filter((ch, k) => ch !== e.words[i - 1][k]).length === 1),
      { message: "Each word must be one letter away from the one above", path: ["words"] },
    ),
  quads: z.object({
    groups: z
      .array(z.object({ label: text(40), words: z.array(word(2, 12)).length(4) }))
      .length(4)
      .refine((g) => new Set(g.flatMap((x) => x.words)).size === 16, "All 16 words must be different"),
  }),
  minicross: z
    .object({
      rows: z.array(z.string().regex(/^[A-Z#]{5}$/, "5 characters, A to Z or #")).length(5),
      across: z.array(text(80)).min(1).max(5),
      down: z.array(text(80)).min(1).max(5),
    })
    .refine((e) => e.rows.join("").replace(/#/g, "").length >= 15, { message: "Too many black squares", path: ["rows"] }),
  hunch: z.object({
    id: z.string().regex(/^[a-z0-9-]{2,30}$/, "Lowercase id, letters, digits and hyphens"),
    category: text(60),
    accept: z.array(text(40)).min(1).max(8),
    warm: z.array(text(30)).max(12),
    clues: z.tuple([text(80), text(80), text(80), text(80), text(80)]),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  quickfire: z.object({
    cat: z.enum(["africa", "sport", "music", "science", "world"]),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    q: text(160),
    answer: text(60),
    wrong: z.tuple([text(60), text(60), text(60)]),
    source: text(120),
  }),
  seven: z
    .object({ centre: word(1, 1), letters: word(6, 6), pangram: word(7, 15) })
    .refine((e) => new Set(e.centre + e.letters).size === 7, { message: "Seven different letters", path: ["letters"] })
    .refine((e) => [...e.pangram].every((ch) => (e.centre + e.letters).includes(ch)) && e.pangram.includes(e.centre), {
      message: "The Spuzl word must use only the set's letters and the centre",
      path: ["pangram"],
    }),
  buried: z.object({
    theme: text(40),
    phrase: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .pipe(z.string().regex(/^[A-Z]+( [A-Z]+)*$/, "Words of A to Z, single spaces")),
    words: z.array(word(3, 10)).min(6).max(24),
  }),
  remix: z.object({ words: z.tuple([word(5, 5), word(6, 6), word(7, 7)]) }),
  pinned: z.object({
    name: text(60),
    line: text(120),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    map: z.enum(["world", "africa"]),
  }),
  flagged: z.object({
    name: text(60),
    continent: z.enum(["africa", "europe", "asia", "americas", "oceania"]),
    capital: text(60).optional(),
    currency: text(60).optional(),
    flag: z.record(z.string(), z.unknown()).optional(),
  }),
  pixl: z
    .object({ name: text(40), rows: z.array(z.string().regex(/^[#.]+$/, "Only # and .")).min(5).max(15) })
    .refine((e) => e.rows.every((r) => r.length === e.rows[0].length), { message: "Rows must share one width", path: ["rows"] }),
} as const;

export type ContentGame = keyof typeof CONTENT_SCHEMAS;
export const CONTENT_GAMES = Object.keys(CONTENT_SCHEMAS) as ContentGame[];
export const isContentGame = (g: string): g is ContentGame => g in CONTENT_SCHEMAS;

/**
 * Games whose approved items can be scheduled as a whole Daily today. Pool games (one question, landmark,
 * country or picture per item) feed Free play and the Daily rotation through content.ts instead.
 * Guess games (coil, rungs, quads, minicross, seven, buried, remix) rebuild each guess from content.ts on the
 * server, so a custom item would get wrong feedback until /api/games/[game]/guess resolves by puzzle id.
 */
export const SCHEDULABLE: Partial<Record<ContentGame, { items: number; guessRoute: boolean }>> = {
  hunch: { items: 1, guessRoute: false },
  quickfire: { items: 5, guessRoute: false },
  coil: { items: 1, guessRoute: true },
  rungs: { items: 1, guessRoute: true },
  quads: { items: 1, guessRoute: true },
  minicross: { items: 1, guessRoute: true },
  seven: { items: 1, guessRoute: true },
  buried: { items: 1, guessRoute: true },
  remix: { items: 1, guessRoute: true },
};

/** Shape of an empty payload, to start the editor from. */
export const TEMPLATES: Record<ContentGame, unknown> = {
  coil: { theme: "", words: ["", "", "", "", "", ""] },
  rungs: { words: ["", "", "", "", "", "", ""], clues: ["", "", "", "", "", "", ""] },
  quads: { groups: [0, 1, 2, 3].map(() => ({ label: "", words: ["", "", "", ""] })) },
  minicross: { rows: ["", "", "", "", ""], across: [""], down: [""] },
  hunch: { id: "", category: "", accept: [""], warm: [], clues: ["", "", "", "", ""], tier: 1 },
  quickfire: { cat: "africa", level: 1, q: "", answer: "", wrong: ["", "", ""], source: "" },
  seven: { centre: "", letters: "", pangram: "" },
  buried: { theme: "", phrase: "", words: [] },
  remix: { words: ["", "", ""] },
  pinned: { name: "", line: "", lat: 0, lon: 0, map: "world" },
  flagged: { name: "", continent: "africa", capital: "", currency: "" },
  pixl: { name: "", rows: ["....."] },
};

/** Quickfire schedules a set of five questions; everything else schedules one entry. */
export const QuickfireSet = z.object({ items: z.array(CONTENT_SCHEMAS.quickfire).length(5) });

export function validatePayload(game: string, payload: unknown) {
  if (!isContentGame(game)) return { success: false as const, issues: [{ path: [] as PropertyKey[], message: "Not a content game" }] };
  const schema = game === "quickfire" && payload && typeof payload === "object" && "items" in payload ? QuickfireSet : CONTENT_SCHEMAS[game];
  const r = schema.safeParse(payload);
  return r.success
    ? { success: true as const, data: r.data as unknown }
    : { success: false as const, issues: r.error.issues.map((i) => ({ path: i.path, message: i.message })) };
}
