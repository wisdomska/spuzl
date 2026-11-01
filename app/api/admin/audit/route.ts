import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ISO_DATE, addDays } from "@/lib/admin/dates";
import { fetchPage, pageParams } from "@/lib/admin/paging";

/**
 * GET /api/admin/audit?actor=&action=&target=&from=&to=&page=&pageSize=: the audit log viewer (FR-AD-08),
 * newest first by id (unique, so pages never overlap). `action` matches a prefix ("daily." finds every Daily
 * action). `before` (an id) is still accepted as an extra filter.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("audit.read");
  const sp = new URL(req.url).searchParams;
  const p = pageParams(sp);
  const actor = sp.get("actor");
  const action = sp.get("action");
  const target = sp.get("target");
  const from = sp.get("from");
  const to = sp.get("to");
  const before = sp.get("before");
  if ((from && !ISO_DATE.test(from)) || (to && !ISO_DATE.test(to))) throw new ApiError(400, "bad_date");
  if (action && !/^[a-z_.:]{1,60}$/.test(action)) throw new ApiError(400, "bad_action");
  const build = () => {
    let q = ctx.db
      .from("audit_log")
      .select("id, actor_id, action, target, detail, created_at", { count: "exact" })
      .order("id", { ascending: false });
    if (actor === "system") q = q.is("actor_id", null);
    else if (actor) q = q.eq("actor_id", actor);
    if (action) q = q.like("action", `${action}%`);
    if (target) q = q.ilike("target", `%${target.replace(/[%_]/g, "")}%`);
    if (from) q = q.gte("created_at", `${from}T00:00:00Z`);
    if (to) q = q.lt("created_at", `${addDays(to, 1)}T00:00:00Z`);
    if (before && /^\d+$/.test(before)) q = q.lt("id", Number(before));
    return q;
  };
  const [{ rows, total }, { data: admins }] = await Promise.all([
    fetchPage(build, p),
    ctx.db.from("admins").select("user_id, email, role"),
  ]);
  return ok({
    rows,
    page: p.page,
    pageSize: p.pageSize,
    total,
    actors: (admins ?? []).map((a) => ({ id: a.user_id, email: a.email, role: a.role })),
  });
});
