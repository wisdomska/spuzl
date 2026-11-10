import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { DEFAULT_META, defaultMetaFor, validateMeta } from "@/lib/games-meta";
import { GAME_BY_ID, RETIRED_GAMES, isLabGame, isLabOn, isRetired } from "@/lib/catalog";
import { getGameSettings } from "@/lib/game-settings/server";
import { revalidatePublicCopy } from "@/lib/seo/revalidate";
import { invalidateGamesMeta, mergeMeta, selectMetaRows, type GameMetaDbRow } from "@/lib/games-meta/server";

const overridden = (r: GameMetaDbRow | undefined) =>
  r?.typical_sec != null || r?.tags != null || r?.rule != null || r?.blurb != null || r?.typical_score != null;
/** Owner decision S: only games scored on points have a Daily Five typical score. */
const scored = (id: string) => GAME_BY_ID[id]?.scoring === "score";
/** The catalog's copy, shown as the default next to an override. */
const copyDefault = (id: string) => ({ rule: GAME_BY_ID[id]?.rule ?? "", blurb: GAME_BY_ID[id]?.blurb ?? "" });

/**
 * GET /api/admin/games/meta: every game's Library metadata (duration, tags, one-line rule and card copy), defaults
 * and overrides (also the export format). Retired games are listed last, marked `retired`, and cannot be changed.
 * Lab games carry `lab` and `labOn`: whether "features.labGames" (Settings page) has switched them on for players.
 */
export const GET = handle(async () => {
  const ctx = await requireAdmin("content.read");
  const [data, settings] = await Promise.all([selectMetaRows(ctx.db), getGameSettings()]);
  const current = mergeMeta(data);
  const byId = Object.fromEntries(data.map((r) => [r.id, r]));
  return ok({
    rows: [
      ...Object.keys(DEFAULT_META).map((id) => {
        const c = copyDefault(id);
        return {
          id,
          ...current[id],
          rule: current[id].rule ?? c.rule,
          blurb: current[id].blurb ?? c.blurb,
          default: { ...DEFAULT_META[id], ...c },
          overridden: overridden(byId[id]),
          ruleOverridden: byId[id]?.rule != null,
          blurbOverridden: byId[id]?.blurb != null,
          scored: scored(id),
          scoreOverridden: byId[id]?.typical_score != null,
          retired: false,
          // Lab games: whether "features.labGames" (Settings page) has switched them on for players
          lab: isLabGame(id),
          labOn: isLabOn(id, settings),
        };
      }),
      ...RETIRED_GAMES.map((g) => {
        const def = defaultMetaFor(g.id);
        const r = byId[g.id];
        return {
          id: g.id,
          typicalSec: r?.typical_sec ?? def.typicalSec,
          tags: r?.tags ?? def.tags,
          rule: r?.rule ?? g.rule,
          blurb: r?.blurb ?? g.blurb,
          default: { ...def, rule: g.rule, blurb: g.blurb },
          overridden: overridden(r),
          ruleOverridden: r?.rule != null,
          blurbOverridden: r?.blurb != null,
          retired: true,
        };
      }),
    ],
    export: Object.fromEntries(
      data
        .filter((r) => overridden(r) && !isRetired(r.id))
        .map((r) => [
          r.id,
          {
            typicalSec: r.typical_sec,
            tags: r.tags,
            ...(r.rule != null ? { rule: r.rule } : {}),
            ...(r.blurb != null ? { blurb: r.blurb } : {}),
            ...(r.typical_score != null ? { typicalScore: r.typical_score } : {}),
          },
        ]),
    ),
  });
});

const Row = z.object({
  typicalSec: z.number().int().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  /** one line, at most 130 characters (validateMeta); null resets to the catalog's rule */
  rule: z.string().max(400).nullable().optional(),
  /** the card copy on the world page; same limits */
  blurb: z.string().max(400).nullable().optional(),
  /** score games only: the Daily Five typical score (half the bonus there); null resets to the code default */
  typicalScore: z.number().int().nullable().optional(),
});
const Patch = z.object({ id: z.string().min(2).max(24) }).merge(Row);
const Import = z.object({ rows: z.record(z.string().min(2).max(24), Row) });

function check(id: string, r: z.infer<typeof Row>) {
  if (isRetired(id)) throw new ApiError(409, "game_retired", id);
  if (!DEFAULT_META[id]) throw new ApiError(404, "unknown_game", id);
  const problem = validateMeta({
    typicalSec: r.typicalSec ?? undefined,
    tags: r.tags ?? undefined,
    rule: r.rule ?? undefined,
    blurb: r.blurb ?? undefined,
    typicalScore: r.typicalScore ?? undefined,
  });
  if (r.typicalScore != null && !scored(id)) throw new ApiError(422, "invalid_meta", `${id}: only score games have a typical score`);
  if (problem) throw new ApiError(422, "invalid_meta", `${id}: ${problem}`);
}

async function apply(ctx: Awaited<ReturnType<typeof requireAdmin>>, id: string, r: z.infer<typeof Row>) {
  check(id, r);
  const patch: Record<string, unknown> = {};
  if (r.typicalSec !== undefined) patch.typical_sec = r.typicalSec;
  if (r.tags !== undefined) patch.tags = r.tags;
  if (r.rule !== undefined) patch.rule = r.rule;
  if (r.blurb !== undefined) patch.blurb = r.blurb;
  if (r.typicalScore !== undefined) patch.typical_score = r.typicalScore;
  if (!Object.keys(patch).length) return;
  const cols = Object.keys(patch).join(", ");
  const { data: before } = await ctx.db.from("games").select(cols).eq("id", id).maybeSingle();
  const { error } = await ctx.db.from("games").update(patch).eq("id", id);
  if (error) throw error;
  invalidateGamesMeta();
  // R4-10: the public game pages, How to play and llms.txt show the copy; rebuild them on their next visit.
  if (r.rule !== undefined || r.blurb !== undefined) revalidatePublicCopy();
  await audit(ctx, "game_meta.update", `game:${id}`, { before, after: patch });
}

/**
 * PATCH /api/admin/games/meta: overrides one game's duration, tags, rule, card copy or (score games) Daily Five typical
 * score; null resets to the default.
 */
export const PATCH = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const { id, ...r } = await body(req, Patch);
  await apply(ctx, id, r);
  return ok({ ok: true });
});

/** PUT /api/admin/games/meta: imports an export ({ rows: { id: { typicalSec, tags, rule?, blurb?, typicalScore? } } }); all rows validate first. */
export const PUT = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const { rows } = await body(req, Import);
  for (const [id, r] of Object.entries(rows)) check(id, r);
  for (const [id, r] of Object.entries(rows)) await apply(ctx, id, r);
  return ok({ imported: Object.keys(rows).length });
});
