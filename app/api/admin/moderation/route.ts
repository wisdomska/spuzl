import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { flaggedRows, reportRows } from "@/lib/admin/moderation";

const TABS = ["reports", "nicknames", "flagged"] as const;
const STATUSES = ["open", "actioned", "dismissed", "all"];

/** GET /api/admin/moderation?tab=reports|nicknames|flagged&status=open: the moderation queue (FR-AD-05). */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("moderation.read");
  const url = new URL(req.url);
  const tab = (url.searchParams.get("tab") ?? "reports") as (typeof TABS)[number];
  const status = url.searchParams.get("status") ?? "open";
  if (!TABS.includes(tab)) throw new ApiError(400, "bad_tab");
  if (!STATUSES.includes(status)) throw new ApiError(400, "bad_status");
  const head = { count: "exact" as const, head: true };
  const [rows, reports, nicknames, flagged] = await Promise.all([
    tab === "flagged" ? flaggedRows(ctx.db) : reportRows(ctx.db, tab, status),
    ctx.db.from("reports").select("id", head).eq("status", "open").neq("target_type", "nickname").neq("reason", "nickname"),
    ctx.db.from("reports").select("id", head).eq("status", "open").or("target_type.eq.nickname,reason.eq.nickname"),
    ctx.db.from("attempts").select("id", head).eq("status", "flagged"),
  ]);
  const counts = { reports: reports.count ?? 0, nicknames: nicknames.count ?? 0, flagged: flagged.count ?? 0 };
  return ok({ tab, rows, counts, open: counts.reports + counts.nicknames + counts.flagged });
});
