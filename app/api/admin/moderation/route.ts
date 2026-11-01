import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { REPORT_KINDS, flaggedRows, reportRows } from "@/lib/admin/moderation";
import { pageParams, sortParams } from "@/lib/admin/paging";
import { MODERATION_SORT } from "@/lib/admin/sorting";

const TABS = ["reports", "nicknames", "party", "flagged"] as const;
const STATUSES = ["open", "actioned", "dismissed", "all"];

/**
 * GET /api/admin/moderation?tab=reports|nicknames|party|flagged&status=open&kind=&sort=&dir=&page=&pageSize=: one page
 * of the moderation queue (FR-AD-05), with the open count per tab. `kind` (player, crew, score, content) narrows
 * the reports tab; sort by created_at (age), kind or status.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("moderation.read");
  const url = new URL(req.url);
  const p = pageParams(url.searchParams);
  const tab = (url.searchParams.get("tab") ?? "reports") as (typeof TABS)[number];
  const status = url.searchParams.get("status") ?? "open";
  const kind = url.searchParams.get("kind");
  const sort = sortParams(url.searchParams, MODERATION_SORT);
  if (kind && !(REPORT_KINDS as readonly string[]).includes(kind)) throw new ApiError(400, "bad_kind");
  if (!TABS.includes(tab)) throw new ApiError(400, "bad_tab");
  if (!STATUSES.includes(status)) throw new ApiError(400, "bad_status");
  const head = { count: "exact" as const, head: true };
  const [list, reports, nicknames, party, flagged] = await Promise.all([
    tab === "flagged" ? flaggedRows(ctx.db, p, sort) : reportRows(ctx.db, tab, status, p, sort, kind),
    ctx.db
      .from("reports")
      .select("id", head)
      .eq("status", "open")
      .neq("target_type", "nickname")
      .neq("target_type", "party")
      .neq("reason", "nickname"),
    ctx.db.from("reports").select("id", head).eq("status", "open").or("target_type.eq.nickname,reason.eq.nickname"),
    // 18+ party content (Draw It, Two Truths): drawings, statements and guesses with a snapshot
    ctx.db.from("reports").select("id", head).eq("status", "open").eq("target_type", "party"),
    ctx.db.from("attempts").select("id", head).eq("status", "flagged"),
  ]);
  const counts = { reports: reports.count ?? 0, nicknames: nicknames.count ?? 0, party: party.count ?? 0, flagged: flagged.count ?? 0 };
  return ok({
    tab,
    rows: list.rows,
    page: p.page,
    pageSize: p.pageSize,
    total: list.total,
    counts,
    open: counts.reports + counts.nicknames + counts.party + counts.flagged,
  });
});
