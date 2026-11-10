/**
 * Quads puzzle packs for the admin console (R2-14): the JSON file the Content page exports and imports.
 * One puzzle is four groups of four words, each with a name and a difficulty (easy, medium, hard, tricky). In a
 * stored payload (content_items.payload, games/quads/content.ts) the difficulty is the group's place, Easy first;
 * in a pack each group also names it, so a file reads well and can list groups in any order.
 * Pure: shared by the editor (client), the import route (server) and the round-trip test.
 */
import { validatePayload } from "@/lib/admin/content-schemas";

export const QUADS_LEVELS = ["easy", "medium", "hard", "tricky"] as const;
export type QuadsLevel = (typeof QUADS_LEVELS)[number];
export const MAX_PACK = 100;

/** A stored payload: groups in difficulty order. */
export interface QuadsPayload {
  groups: { label: string; words: string[] }[];
}

export interface PackGroup {
  difficulty: QuadsLevel;
  label: string;
  words: string[];
}
export interface QuadsPack {
  app: "spuzl";
  kind: "quads";
  version: 1;
  puzzles: { groups: PackGroup[] }[];
}

/** The editor's working copy: always four groups of four slots, whatever the JSON held. */
export function toDraft(value: unknown): QuadsPayload {
  const groups = (value as { groups?: unknown } | null)?.groups;
  return {
    groups: [0, 1, 2, 3].map((i) => {
      const g = (Array.isArray(groups) ? groups[i] : null) as { label?: unknown; words?: unknown } | null;
      const words = Array.isArray(g?.words) ? g.words : [];
      return {
        label: typeof g?.label === "string" ? g.label : "",
        words: [0, 1, 2, 3].map((k) => (typeof words[k] === "string" ? (words[k] as string) : "")),
      };
    }),
  };
}

/** Pretty JSON of puzzles (stored payloads), each group named with its difficulty. */
export function packToJson(puzzles: readonly QuadsPayload[]): string {
  const pack: QuadsPack = {
    app: "spuzl",
    kind: "quads",
    version: 1,
    puzzles: puzzles.map((p) => ({
      groups: p.groups.map((g, i) => ({ difficulty: QUADS_LEVELS[i], label: g.label, words: [...g.words] })),
    })),
  };
  return JSON.stringify(pack, null, 2) + "\n";
}

/**
 * Reads a pack (or a bare list of puzzles, as content.ts writes them) back into stored payloads. Groups are put
 * in difficulty order; every problem is listed with its puzzle number, and nothing passes unless all do: four
 * groups, one of each difficulty, four different words each, sixteen different words in all (the editor's
 * schema, lib/admin/content-schemas.ts).
 */
export function parsePack(text: string): { ok: true; puzzles: QuadsPayload[] } | { ok: false; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["Not valid JSON."] };
  }
  const list = Array.isArray(raw) ? raw : (raw as Partial<QuadsPack> | null)?.kind === "quads" ? (raw as QuadsPack).puzzles : null;
  if (!Array.isArray(list)) return { ok: false, errors: ['Not a Quads pack (expected kind "quads" and a puzzles list).'] };
  if (!list.length) return { ok: false, errors: ["The pack has no puzzles."] };
  if (list.length > MAX_PACK) return { ok: false, errors: [`At most ${MAX_PACK} puzzles per import.`] };
  const errors: string[] = [];
  const puzzles: QuadsPayload[] = [];
  list.forEach((p: unknown, n) => {
    const at = `Puzzle ${n + 1}`;
    const groups = (p as { groups?: unknown } | null)?.groups;
    if (!Array.isArray(groups)) return void errors.push(`${at}: needs a groups list.`);
    const named = groups.every((g) => g && typeof g === "object" && "difficulty" in g);
    let ordered: unknown[] = groups;
    if (named) {
      const levels = groups.map((g) => (g as PackGroup).difficulty);
      if (groups.length !== 4 || QUADS_LEVELS.some((l) => levels.filter((x) => x === l).length !== 1))
        return void errors.push(`${at}: needs one group of each difficulty (easy, medium, hard, tricky).`);
      ordered = QUADS_LEVELS.map((l) => groups.find((g) => (g as PackGroup).difficulty === l));
    }
    const payload = { groups: ordered.map((g) => ({ label: (g as PackGroup)?.label, words: (g as PackGroup)?.words })) };
    const v = validatePayload("quads", payload);
    if (!v.success) {
      for (const i of v.issues.slice(0, 4)) errors.push(`${at}: ${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`);
      return;
    }
    puzzles.push(v.data as QuadsPayload);
  });
  return errors.length ? { ok: false, errors } : { ok: true, puzzles };
}

/** Moves the group at `from` to difficulty `to`, swapping with the group there (the editor's difficulty picker). */
export function setDifficulty<T>(groups: readonly T[], from: number, to: number): T[] {
  const out = groups.slice();
  [out[from], out[to]] = [out[to], out[from]];
  return out;
}

/** Every word in more than one group of an unfinished payload, for the editor to flag as you type. */
export function repeatedWords(p: { groups: { words: string[] }[] }): Set<string> {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const g of p.groups)
    for (const raw of g.words) {
      const w = raw.trim().toUpperCase();
      if (!w) continue;
      if (seen.has(w)) twice.add(w);
      seen.add(w);
    }
  return twice;
}
