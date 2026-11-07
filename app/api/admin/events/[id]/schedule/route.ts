import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { windowProblem } from "@/lib/events";
import { EVENT_COLS } from "@/lib/events/server";

const Body = z.object({ id: z.string().optional(), scheduled: z.boolean() }).strict();

/**
 * POST /api/admin/events/:id/schedule { scheduled }: schedules a draft (it runs from its start date) or puts an event
 * back to draft (it stops at once; progress is kept). Scheduling checks the dates again and refuses an event that
 * would already be over. Audited as event.schedule or event.unschedule.
 */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/events/[id]/schedule">) => {
  const ctx = await requireAdmin("events.write");
  const id = z.uuid().parse((await rc.params).id);
  const { id: bodyId, scheduled } = await body(req, Body);
  if (bodyId !== undefined && bodyId !== id) throw new ApiError(400, "id_mismatch");
  const { data: before } = await ctx.db.from("events").select(EVENT_COLS).eq("id", id).maybeSingle();
  if (!before) throw new ApiError(404, "event_not_found");
  if (scheduled) {
    const problem = windowProblem(before.starts_at, before.ends_at);
    if (problem) throw new ApiError(422, "bad_dates", problem);
    if (Date.parse(before.ends_at) <= Date.now())
      throw new ApiError(422, "bad_dates", "That event would already be over. Change its dates first.");
  }
  const { data, error } = await ctx.db
    .from("events")
    .update({ draft: !scheduled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(EVENT_COLS)
    .single();
  if (error) throw error;
  await audit(ctx, scheduled ? "event.schedule" : "event.unschedule", `event:${id}`, { before, after: data });
  return ok(data);
});
