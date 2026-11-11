import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ISO_DATE, addDays } from "@/lib/admin/dates";
import { fetchPage, pageParams, sortParams } from "@/lib/admin/paging";
import { AUDIT_SORT } from "@/lib/admin/sorting";
import { AUDIT_TYPES, isAuditType, playerIdsIn, type AuditRow } from "@/lib/admin/audit-log";

/** Ids follow insertion order, so "when" sorts by id (unique: pages never overlap). */
const COLUMN = { created_at: "id", action: "action", target: "target" } as const;

/**
 * GET /api/admin/audit?actor=&action=&target=&from=&to=&sort=&dir=&page=&pageSize=: the audit log viewer
 * (FR-AD-08), newest first by id (unique, so pages never overlap) or sorted by action or target (newest first
 * within each). `action` matches a prefix ("daily." finds every Daily
 * action). `before` (an id) is still accepted as an extra filter. `type` is one of the plain types of change
 * (AUDIT_TYPES: players, content, daily, ...), `auto=hide` leaves out automatic jobs (rows with no person). The
 * response names team members (`actors`, with their player nickname when they have one) and the players the page
 * mentions (`players`: id to nickname), so the console can write each row as a sentence.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("audit.read");
  const sp = new URL(req.url).searchParams;
  const p = pageParams(sp);
  const { sort, dir } = sortParams(sp, AUDIT_SORT);
  const actor = sp.get("actor");
  const action = sp.get("action");
  const target = sp.get("target");
  const from = sp.get("from");
  const to = sp.get("to");
  const before = sp.get("before");
  if ((from && !ISO_DATE.test(from)) || (to && !ISO_DATE.test(to))) throw new ApiError(400, "bad_date");
  if (action && !/^[a-z_.:]{1,60}$/.test(action)) throw new ApiError(400, "bad_action");
  const type = sp.get("type");
  if (type && !isAuditType(type)) throw new ApiError(400, "bad_type");
  const hideAuto = sp.get("auto") === "hide";
  const build = () => {
    let q = ctx.db
      .from("audit_log")
      .select("id, actor_id, action, target, detail, created_at", { count: "exact" })
      .order(COLUMN[sort], { ascending: dir === "asc", nullsFirst: false });
    if (sort !== "created_at") q = q.order("id", { ascending: false });
    if (actor === "system") q = q.is("actor_id", null);
    else if (actor) q = q.eq("actor_id", actor);
    else if (hideAuto) q = q.not("actor_id", "is", null);
    if (action) q = q.like("action", `${action}%`);
    if (type && isAuditType(type)) q = q.or(AUDIT_TYPES[type].map((p) => `action.like.${p}`).join(","));
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
  // Names for the sentences: team members' and mentioned players' nicknames (an admin's player profile, when
  // they have one). One lookup per page.
  const ids = [...new Set([...(admins ?? []).map((a) => a.user_id as string), ...playerIdsIn(rows as AuditRow[])])];
  const { data: named } = ids.length ? await ctx.db.from("players").select("id, nickname").in("id", ids) : { data: [] };
  const nick = new Map((named ?? []).map((r) => [r.id as string, String(r.nickname)]));
  return ok({
    rows,
    page: p.page,
    pageSize: p.pageSize,
    total,
    actors: (admins ?? []).map((a) => ({ id: a.user_id, email: a.email, role: a.role, nickname: nick.get(a.user_id) ?? null })),
    players: Object.fromEntries(playerIdsIn(rows as AuditRow[]).flatMap((id) => (nick.has(id) ? [[id, nick.get(id)!]] : []))),
  });
});
