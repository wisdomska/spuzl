import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { EventPatch, windowProblem } from "@/lib/events";
import { EVENT_COLS } from "@/lib/events/server";

const eventId = async (rc: RouteContext<"/api/admin/events/[id]">) => z.uuid().parse((await rc.params).id);

/**
 * PATCH /api/admin/events/:id: edits an event (any subset of fields). The merged dates must still be valid.
 * The body may repeat the event's own `id` (the console's action hook sends it); any other id is refused.
 */
export const PATCH = handle(async (req: Request, rc: RouteContext<"/api/admin/events/[id]">) => {
  const ctx = await requireAdmin("events.write");
  const id = await eventId(rc);
  const { id: bodyId, ...rest } = await body(req, z.record(z.string(), z.unknown()));
  if (bodyId !== undefined && bodyId !== id) throw new ApiError(400, "id_mismatch");
  const input = EventPatch.parse(rest);
  const { data: before } = await ctx.db.from("events").select(EVENT_COLS).eq("id", id).maybeSingle();
  if (!before) throw new ApiError(404, "event_not_found");
  const startsAt = input.startsAt ?? before.starts_at;
  const endsAt = input.endsAt ?? before.ends_at;
  const problem = windowProblem(startsAt, endsAt);
  if (problem) throw new ApiError(422, "bad_dates", problem);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt;
  if (input.accent !== undefined) patch.accent = input.accent;
  if (input.banner !== undefined) patch.banner = input.banner;
  if (input.quest !== undefined) patch.quest = input.quest;
  const { data, error } = await ctx.db.from("events").update(patch).eq("id", id).select(EVENT_COLS).single();
  if (error) throw error;
  await audit(ctx, "event.update", `event:${id}`, { before, after: data });
  return ok(data);
});

/**
 * DELETE /api/admin/events/:id: removes an event and its quest progress. Rewards already claimed stay paid
 * (the ledgers keep them). To stop a live event but keep its record, set its end to now instead.
 */
export const DELETE = handle(async (_req: Request, rc: RouteContext<"/api/admin/events/[id]">) => {
  const ctx = await requireAdmin("events.write");
  const id = await eventId(rc);
  const { data: before, error } = await ctx.db.from("events").delete().eq("id", id).select(EVENT_COLS).maybeSingle();
  if (error) throw error;
  if (!before) throw new ApiError(404, "event_not_found");
  await audit(ctx, "event.delete", `event:${id}`, { before });
  return ok({ ok: true });
});
