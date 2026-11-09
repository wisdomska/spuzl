import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { todayIso } from "@/lib/admin/dates";
import { pageParams } from "@/lib/admin/paging";
import { can } from "@/lib/admin/roles";
import { FEEDBACK_EXPORT_MAX, feedbackCsv, feedbackFilename, parseFeedbackFilters } from "@/lib/admin/feedback";
import { feedbackAll, feedbackPage } from "@/lib/admin/feedback-server";

/**
 * GET /api/admin/feedback?status=&kind=&page=&pageSize=: messages from the /contact form (R4-02), newest first.
 * The email is masked unless the role holds players.pii (as on the Players page). Roles with "feedback.read".
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("feedback.read");
  const sp = new URL(req.url).searchParams;
  const p = pageParams(sp);
  const f = parseFeedbackFilters(Object.fromEntries(sp));
  if (!f.ok) throw new ApiError(400, f.error);
  const { rows, total } = await feedbackPage(ctx.db, f.filters, p, can(ctx.role, "players.pii"));
  return ok({ rows, page: p.page, pageSize: p.pageSize, total });
});

const Export = z.object({ status: z.string().optional(), kind: z.string().optional() });

/** POST /api/admin/feedback {filters}: the matching messages as CSV ({filename, csv, rows, total}), masked as above. Audited. */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("feedback.read");
  const f = parseFeedbackFilters(await body(req, Export));
  if (!f.ok) throw new ApiError(400, f.error);
  const pii = can(ctx.role, "players.pii");
  const { rows, total } = await feedbackAll(ctx.db, f.filters, FEEDBACK_EXPORT_MAX, pii);
  await audit(ctx, "feedback.export", "feedback", { ...f.filters, rows: rows.length, total, emails: pii ? "full" : "masked" });
  return ok({ filename: feedbackFilename(f.filters, todayIso()), csv: feedbackCsv(rows), rows: rows.length, total });
});
