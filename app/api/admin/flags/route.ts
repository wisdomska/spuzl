import { z } from "zod";
import { body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";

/** GET /api/admin/flags: every feature flag (FR-AD-07). */
export const GET = handle(async () => {
  const ctx = await requireAdmin("flags.read");
  const { data, error } = await ctx.db.from("feature_flags").select("key, enabled, payload, updated_by, updated_at").order("key");
  if (error) throw error;
  return ok({ rows: data ?? [] });
});

const Put = z.object({
  key: z.string().regex(/^[a-z0-9_.:-]{2,60}$/, "lowercase letters, digits and . _ : -"),
  enabled: z.boolean(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

/** PUT /api/admin/flags: creates or updates a flag. */
export const PUT = handle(async (req: Request) => {
  const ctx = await requireAdmin("flags.write");
  const { key, enabled, payload } = await body(req, Put);
  const { data: before } = await ctx.db.from("feature_flags").select("enabled, payload").eq("key", key).maybeSingle();
  const row: Record<string, unknown> = { key, enabled, updated_by: ctx.user.id, updated_at: new Date().toISOString() };
  if (payload !== undefined) row.payload = payload;
  const { data, error } = await ctx.db.from("feature_flags").upsert(row, { onConflict: "key" }).select().single();
  if (error) throw error;
  await audit(ctx, before ? "flag.update" : "flag.create", `flag:${key}`, { before, after: { enabled, payload } });
  return ok(data);
});
