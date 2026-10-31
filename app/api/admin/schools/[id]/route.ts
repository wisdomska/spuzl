import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";

const Body = z.object({ decision: z.enum(["verify", "unverify"]) });

/** POST /api/admin/schools/:id: verifies a school (its name then shows on boards) or withdraws verification. */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/schools/[id]">) => {
  const ctx = await requireAdmin("schools.write");
  const id = z.string().uuid().parse((await rc.params).id);
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
