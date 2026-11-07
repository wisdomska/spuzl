/**
 * List packs for the admin Content page (R2-P5): a JSON file holding one kind of content as a plain list, like the
 * Quads packs (lib/admin/quads-pack.ts) but for content that is one entry per item (Two Truths rounds, Draw It
 * words). Pure: shared by the editors (client), the import route (server) and the round-trip tests.
 *
 *   { "app": "spuzl", "kind": "<kind>", "version": 1, "<key>": [ ...items ] }
 *
 * A bare list of items (as content.ts writes them) reads back too.
 */
export type ItemCheck<T> = { ok: true; value: T } | { ok: false; errors: string[] };
export type PackResult<T> = { ok: true; items: T[] } | { ok: false; errors: string[] };

export function listPackToJson<T>(kind: string, key: string, items: readonly T[]): string {
  return JSON.stringify({ app: "spuzl", kind, version: 1, [key]: items }, null, 2) + "\n";
}

/**
 * Reads a pack back. Every problem is listed with its item number (`noun n`), and nothing passes unless all do;
 * `unique` (optional) names an item's identity, so the same entry can't be in one pack twice.
 */
export function parseListPack<T>(
  text: string,
  opts: { kind: string; key: string; noun: string; max: number; check: (raw: unknown) => ItemCheck<T>; unique?: (item: T) => string },
): PackResult<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["Not valid JSON."] };
  }
  const obj = raw as Record<string, unknown> | null;
  const list = Array.isArray(raw) ? raw : obj && obj.kind === opts.kind ? obj[opts.key] : null;
  if (!Array.isArray(list))
    return { ok: false, errors: [`Not a ${opts.kind} pack (expected kind "${opts.kind}" and a ${opts.key} list).`] };
  if (!list.length) return { ok: false, errors: [`The pack has no ${opts.key}.`] };
  if (list.length > opts.max) return { ok: false, errors: [`At most ${opts.max} ${opts.key} per pack.`] };
  const errors: string[] = [];
  const items: T[] = [];
  const seen = new Map<string, number>();
  list.forEach((entry, n) => {
    const at = `${opts.noun} ${n + 1}`;
    const r = opts.check(entry);
    if (!r.ok) {
      for (const e of r.errors.slice(0, 4)) errors.push(`${at}: ${e}`);
      return;
    }
    if (opts.unique) {
      const id = opts.unique(r.value);
      const first = seen.get(id);
      if (first !== undefined) return void errors.push(`${at}: the same as ${opts.noun.toLowerCase()} ${first + 1}.`);
      seen.set(id, n);
    }
    items.push(r.value);
  });
  return errors.length ? { ok: false, errors } : { ok: true, items };
}
