import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ISO_DATE, addDays } from "@/lib/admin/dates";

/**
 * GET /api/admin/audit?actor=&action=&target=&from=&to=&before=: the audit log viewer (FR-AD-08), newest
 * first, 100 per page. `action` matches a prefix ("daily." finds every Daily action). `before` is the last id.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("audit.read");
  const sp = new URL(req.url).searchParams;
  const actor = sp.get("actor");
  const action = sp.get("action");
  const target = sp.get("target");
  const from = sp.get("from");
  const to = sp.get("to");
  const before = sp.get("before");
  if ((from && !ISO_DATE.test(from)) || (to && !ISO_DATE.test(to))) throw new ApiError(400, "bad_date");
  if (action && !/^[a-z_.:]{1,60}$/.test(action)) throw new ApiError(400, "bad_action");
  let q = ctx.db.from("audit_log").select("id, actor_id, action, target, detail, created_at").order("id", { ascending: false }).limit(100);
  if (actor === "system") q = q.is("actor_id", null);
  else if (actor) q = q.eq("actor_id", actor);
  if (action) q = q.like("action", `${action}%`);
  if (target) q = q.ilike("target", `%${target.replace(/[%_]/g, "")}%`);
  if (from) q = q.gte("created_at", `${from}T00:00:00Z`);
  if (to) q = q.lt("created_at", `${addDays(to, 1)}T00:00:00Z`);
  if (before && /^\d+$/.test(before)) q = q.lt("id", Number(before));
  const { data, error } = await q;
  if (error) throw error;
  const { data: admins } = await ctx.db.from("admins").select("user_id, email, role");
  return ok({
    rows: data ?? [],
    actors: (admins ?? []).map((a) => ({ id: a.user_id, email: a.email, role: a.role })),
  });
});
