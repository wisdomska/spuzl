import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { flaggedRows, reportRows } from "@/lib/admin/moderation";
import { pageParams } from "@/lib/admin/paging";

const TABS = ["reports", "nicknames", "flagged"] as const;
const STATUSES = ["open", "actioned", "dismissed", "all"];

/**
 * GET /api/admin/moderation?tab=reports|nicknames|flagged&status=open&page=&pageSize=: one page of the
 * moderation queue (FR-AD-05), with the open count per tab.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("moderation.read");
  const url = new URL(req.url);
  const p = pageParams(url.searchParams);
  const tab = (url.searchParams.get("tab") ?? "reports") as (typeof TABS)[number];
  const status = url.searchParams.get("status") ?? "open";
  if (!TABS.includes(tab)) throw new ApiError(400, "bad_tab");
  if (!STATUSES.includes(status)) throw new ApiError(400, "bad_status");
  const head = { count: "exact" as const, head: true };
  const [list, reports, nicknames, flagged] = await Promise.all([
    tab === "flagged" ? flaggedRows(ctx.db, p) : reportRows(ctx.db, tab, status, p),
    ctx.db.from("reports").select("id", head).eq("status", "open").neq("target_type", "nickname").neq("reason", "nickname"),
    ctx.db.from("reports").select("id", head).eq("status", "open").or("target_type.eq.nickname,reason.eq.nickname"),
    ctx.db.from("attempts").select("id", head).eq("status", "flagged"),
  ]);
  const counts = { reports: reports.count ?? 0, nicknames: nicknames.count ?? 0, flagged: flagged.count ?? 0 };
  return ok({
    tab,
    rows: list.rows,
    page: p.page,
    pageSize: p.pageSize,
    total: list.total,
    counts,
    open: counts.reports + counts.nicknames + counts.flagged,
  });
});
