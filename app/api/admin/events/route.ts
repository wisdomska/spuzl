import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { fetchPage, pageParams, sortParams } from "@/lib/admin/paging";
import { EVENT_SORT } from "@/lib/admin/sorting";
import { EventCreate, eventStatus, windowProblem, type EventRow } from "@/lib/events";
import { EVENT_COLS } from "@/lib/events/server";

/**
 * GET /api/admin/events?status=upcoming|live|ended&sort=&dir=&page=&pageSize=: seasonal events, latest start
 * first unless sorted by end or name (id breaks ties), each with its status (upcoming, live, ended) and how many
 * players have completed its bonus quest.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("events.read");
  const p = pageParams(req);
  const sp = new URL(req.url).searchParams;
  const { sort, dir } = sortParams(sp, EVENT_SORT);
  const status = sp.get("status");
  if (status && !["upcoming", "live", "ended"].includes(status)) throw new ApiError(400, "bad_status");
  const asc = dir === "asc";
  const at = new Date().toISOString();
  const { rows, total } = await fetchPage<EventRow & { created_by: string | null; updated_at: string }>(() => {
    let q = ctx.db
      .from("events")
      .select(`${EVENT_COLS}, created_by, updated_at`, { count: "exact" })
      .order(sort, { ascending: asc })
      .order("id", { ascending: asc });
    if (status === "upcoming") q = q.gt("starts_at", at);
    if (status === "live") q = q.lte("starts_at", at).gt("ends_at", at);
    if (status === "ended") q = q.lte("ends_at", at);
    return q;
  }, p);
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
