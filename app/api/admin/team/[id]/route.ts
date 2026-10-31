import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { ROLES } from "@/lib/admin/roles";

const Body = z.object({ role: z.enum(ROLES).optional(), disabled: z.boolean().optional() });

/** PATCH /api/admin/team/:id: change an admin's role or disable them. Owners cannot demote or disable themselves. */
export const PATCH = handle(async (req: Request, rc: RouteContext<"/api/admin/team/[id]">) => {
  const ctx = await requireAdmin("team.manage");
  const id = z
    .string()
    .uuid()
    .parse((await rc.params).id);
  const b = await body(req, Body);
  if (id === ctx.user.id) throw new ApiError(409, "self", "Ask another owner to change your own access.");
  const patch: Record<string, unknown> = {};
  if (b.role) patch.role = b.role;
  if (b.disabled !== undefined) patch.disabled_at = b.disabled ? new Date().toISOString() : null;
  if (!Object.keys(patch).length) throw new ApiError(400, "empty_patch");
  const { data, error } = await ctx.db.from("admins").update(patch).eq("user_id", id).select("user_id, role, disabled_at").maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "admin_not_found");
  await audit(ctx, b.disabled !== undefined ? (b.disabled ? "admin.disable" : "admin.enable") : "admin.role", `admin:${id}`, b);
  return ok(data);
});
