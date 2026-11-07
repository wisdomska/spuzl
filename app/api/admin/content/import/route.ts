import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { ITEM_COLS } from "@/lib/admin/content-files";
import { parsePack } from "@/lib/admin/quads-pack";
import { parseTruthsPack } from "@/lib/admin/truths-pack";

const Import = z.object({ game: z.enum(["quads", "twotruths"]), text: z.string().max(400_000) });

/** Each importable game's pack: its stored payloads, or every problem in the file. */
function readPack(game: "quads" | "twotruths", text: string): { ok: true; payloads: unknown[] } | { ok: false; errors: string[] } {
  if (game === "quads") {
    const p = parsePack(text);
    return p.ok ? { ok: true, payloads: p.puzzles } : p;
  }
  const p = parseTruthsPack(text);
  return p.ok ? { ok: true, payloads: p.items } : p;
}

const NOTES = { quads: "Imported from a Quads pack", twotruths: "Imported from a Two Truths pack" } as const;

/**
 * POST /api/admin/content/import: a Quads pack (lib/admin/quads-pack.ts) or a Two Truths and a Lie pack
 * (lib/admin/truths-pack.ts, R2-P5) becomes drafts, one per puzzle or round, by the caller, for the usual
 * two-person review. All or nothing: any problem in the file and nothing is saved (422 with every problem listed).
 * Content editors and the owner; audited with the count.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const { game, text } = await body(req, Import);
  const pack = readPack(game, text);
  if (!pack.ok)
    return Response.json({ error: "invalid_pack", message: pack.errors.slice(0, 3).join(" "), errors: pack.errors }, { status: 422 });
  const rows = pack.payloads.map((payload) => ({
    game_id: game,
    payload,
    notes: NOTES[game],
    author_id: ctx.user.id,
    status: "draft",
    source: "editor",
  }));
  const { data, error } = await ctx.db.from("content_items").insert(rows).select(ITEM_COLS);
  if (error) throw error;
  if (!data?.length) throw new ApiError(500, "import_failed");
  await audit(ctx, "content.import", `content:${game}`, { game, count: data.length });
  return ok({ created: data.length, ids: data.map((r) => r.id) });
});
