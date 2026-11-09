import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { FEEDBACK_MARKS } from "@/lib/admin/feedback";

const Id = z.uuid();
const Body = z.object({ status: z.enum(FEEDBACK_MARKS) });

/** POST /api/admin/feedback/:id {status}: mark a message read or done (or back to new). Audited. "feedback.write". */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/feedback/[id]">) => {
  const ctx = await requireAdmin("feedback.write");
  const id = Id.parse((await rc.params).id);
  const { status } = await body(req, Body);
  const { data: was } = await ctx.db.from("feedback").select("status").eq("id", id).maybeSingle();
  if (!was) throw new ApiError(404, "feedback_not_found");
  const { error } = await ctx.db
    .from("feedback")
    .update({
      status,
      handled_by: status === "new" ? null : ctx.user.id,
      handled_at: status === "new" ? null : new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  await audit(ctx, `feedback.${status}`, `feedback:${id}`, { from: was.status });
  return ok({ ok: true, status });
});
