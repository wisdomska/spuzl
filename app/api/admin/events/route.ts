import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { fetchPage, pageParams } from "@/lib/admin/paging";
import { EventCreate, eventStatus, windowProblem, type EventRow } from "@/lib/events";
import { EVENT_COLS } from "@/lib/events/server";

/**
 * GET /api/admin/events?page=&pageSize=: seasonal events, latest start first (id breaks ties), each with its
 * status (upcoming, live, ended) and how many players have completed its bonus quest.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("events.read");
  const p = pageParams(req);
  const { rows, total } = await fetchPage<EventRow & { created_by: string | null; updated_at: string }>(
    () =>
      ctx.db
        .from("events")
        .select(`${EVENT_COLS}, created_by, updated_at`, { count: "exact" })
        .order("starts_at", { ascending: false })
        .order("id", { ascending: false }),
    p,
  );
  const ids = rows.map((r) => r.id);
  const { data: done } = ids.length
    ? await ctx.db.from("event_progress").select("event_id").in("event_id", ids).not("completed_at", "is", null)
    : { data: [] };
  const now = Date.now();
  return ok({
    rows: rows.map((r) => ({
      ...r,
      status: eventStatus(r, now),
      completed: (done ?? []).filter((d) => d.event_id === r.id).length,
    })),
    page: p.page,
    pageSize: p.pageSize,
    total,
  });
});

/** POST /api/admin/events: creates an event. Dates are checked (ends after it starts, at most 62 days, not over). */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("events.write");
  const input = await body(req, EventCreate);
  const problem = windowProblem(input.startsAt, input.endsAt);
  if (problem) throw new ApiError(422, "bad_dates", problem);
  if (Date.parse(input.endsAt) <= Date.now()) throw new ApiError(422, "bad_dates", "That event would already be over.");
  const { data, error } = await ctx.db
    .from("events")
    .insert({
      name: input.name,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      accent: input.accent,
      banner: input.banner,
      quest: input.quest,
      created_by: ctx.user.id,
    })
    .select(EVENT_COLS)
    .single();
  if (error) throw error;
  await audit(ctx, "event.create", `event:${data.id}`, { after: data });
  return ok(data);
});
