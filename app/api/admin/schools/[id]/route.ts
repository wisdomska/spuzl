import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { SchoolPatch } from "@/lib/schools";

const Body = z.object({ decision: z.enum(["verify", "unverify"]) });

/** POST /api/admin/schools/:id: verifies a school (its name then shows on boards) or withdraws verification. */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/schools/[id]">) => {
  const ctx = await requireAdmin("schools.write");
  const id = z
    .string()
    .uuid()
    .parse((await rc.params).id);
  const { decision } = await body(req, Body);
  const { data, error } = await ctx.db
    .from("schools")
    .update({ verified_by: decision === "verify" ? ctx.user.id : null })
    .eq("id", id)
    .select("id, name")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "school_not_found");
  await audit(ctx, `school.${decision}`, `school:${id}`, { name: data.name });
  return ok({ ok: true });
});

/**
 * PATCH /api/admin/schools/:id { name?, city?, country?, kind? }: edits a school or campus (R2-P5). The body may
 * repeat the school's own `id` (the console's action hook sends it). Audited as school.update with before and after.
 */
export const PATCH = handle(async (req: Request, rc: RouteContext<"/api/admin/schools/[id]">) => {
  const ctx = await requireAdmin("schools.write");
  const id = z
    .string()
    .uuid()
    .parse((await rc.params).id);
  const { id: bodyId, ...rest } = await body(req, z.record(z.string(), z.unknown()));
  if (bodyId !== undefined && bodyId !== id) throw new ApiError(400, "id_mismatch");
  const input = SchoolPatch.parse(rest);
  const { data: before } = await ctx.db.from("schools").select("id, name, city, country, kind").eq("id", id).maybeSingle();
  if (!before) throw new ApiError(404, "school_not_found");
  const { data, error } = await ctx.db
    .from("schools")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, city, country, kind")
    .single();
  if (error) throw error;
  await audit(ctx, "school.update", `school:${id}`, { before, after: data });
  return ok(data);
});
