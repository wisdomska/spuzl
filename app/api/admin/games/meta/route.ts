import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { DEFAULT_META, defaultMetaFor, validateMeta } from "@/lib/games-meta";
import { RETIRED_GAMES, isRetired } from "@/lib/catalog";
import { mergeMeta } from "@/lib/games-meta/server";

/**
 * GET /api/admin/games/meta: every game's Library metadata, defaults and overrides (also the export format).
 * Retired games are listed last, marked `retired`, and cannot be changed.
 */
export const GET = handle(async () => {
  const ctx = await requireAdmin("content.read");
  const { data, error } = await ctx.db.from("games").select("id, typical_sec, tags");
  if (error) throw error;
  const current = mergeMeta(data ?? []);
  return ok({
    rows: [
      ...Object.keys(DEFAULT_META).map((id) => {
        const r = (data ?? []).find((x) => x.id === id);
        return { id, ...current[id], default: DEFAULT_META[id], overridden: r?.typical_sec != null || r?.tags != null, retired: false };
      }),
      ...RETIRED_GAMES.map((g) => {
        const def = defaultMetaFor(g.id);
        const r = (data ?? []).find((x) => x.id === g.id);
        return {
          id: g.id,
          typicalSec: r?.typical_sec ?? def.typicalSec,
          tags: r?.tags ?? def.tags,
          default: def,
          overridden: r?.typical_sec != null || r?.tags != null,
          retired: true,
        };
      }),
    ],
    export: Object.fromEntries(
      (data ?? [])
        .filter((r) => (r.typical_sec != null || r.tags != null) && !isRetired(r.id))
        .map((r) => [r.id, { typicalSec: r.typical_sec, tags: r.tags }]),
    ),
  });
});

const Row = z.object({
  typicalSec: z.number().int().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});
const Patch = z.object({ id: z.string().min(2).max(24) }).merge(Row);
const Import = z.object({ rows: z.record(z.string().min(2).max(24), Row) });

async function apply(ctx: Awaited<ReturnType<typeof requireAdmin>>, id: string, r: z.infer<typeof Row>) {
  if (isRetired(id)) throw new ApiError(409, "game_retired", id);
  if (!DEFAULT_META[id]) throw new ApiError(404, "unknown_game", id);
  const problem = validateMeta({ typicalSec: r.typicalSec ?? undefined, tags: r.tags ?? undefined });
  if (problem) throw new ApiError(422, "invalid_meta", `${id}: ${problem}`);
  const patch: Record<string, unknown> = {};
  if (r.typicalSec !== undefined) patch.typical_sec = r.typicalSec;
  if (r.tags !== undefined) patch.tags = r.tags;
  const { data: before } = await ctx.db.from("games").select("typical_sec, tags").eq("id", id).maybeSingle();
  const { error } = await ctx.db.from("games").update(patch).eq("id", id);
  if (error) throw error;
  await audit(ctx, "game_meta.update", `game:${id}`, { before, after: patch });
}

/** PATCH /api/admin/games/meta: overrides one game's duration or tags (null resets to the default). */
export const PATCH = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const { id, ...r } = await body(req, Patch);
  await apply(ctx, id, r);
  return ok({ ok: true });
});

/** PUT /api/admin/games/meta: imports an export ({ rows: { id: { typicalSec, tags } } }); all rows validate first. */
export const PUT = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const { rows } = await body(req, Import);
  for (const [id, r] of Object.entries(rows)) {
    if (isRetired(id)) throw new ApiError(409, "game_retired", id);
    if (!DEFAULT_META[id]) throw new ApiError(404, "unknown_game", id);
    const problem = validateMeta({ typicalSec: r.typicalSec ?? undefined, tags: r.tags ?? undefined });
    if (problem) throw new ApiError(422, "invalid_meta", `${id}: ${problem}`);
  }
  for (const [id, r] of Object.entries(rows)) await apply(ctx, id, r);
  return ok({ imported: Object.keys(rows).length });
});
