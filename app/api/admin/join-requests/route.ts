import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { todayIso } from "@/lib/admin/dates";
import { pageParams } from "@/lib/admin/paging";
import { JOIN_LOG_EXPORT_MAX, joinLogCsv, joinLogFilename, parseJoinLogFilters } from "@/lib/admin/join-log";
import { joinLogAll, joinLogPage } from "@/lib/admin/join-log-server";

/**
 * GET /api/admin/join-requests?status=&kind=&q=&from=&to=&page=&pageSize=: the join-approval log for under-16
 * hosts' friends-only rooms (R2-13), newest first: who asked, the host, the room, the outcome and when. No chat
 * or other content. Moderators and owners only ("joinlog.read").
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("joinlog.read");
  const sp = new URL(req.url).searchParams;
  const p = pageParams(sp);
  const f = parseJoinLogFilters(Object.fromEntries(sp));
  if (!f.ok) throw new ApiError(400, f.error);
  const { rows, total } = await joinLogPage(ctx.db, f.filters, p);
  return ok({ rows, page: p.page, pageSize: p.pageSize, total });
});

const Export = z.object({
  status: z.string().optional(),
  kind: z.string().optional(),
  q: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** POST /api/admin/join-requests {filters}: the matching log as CSV ({filename, csv, rows, total}). Every export is audited. */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("joinlog.read");
  const f = parseJoinLogFilters(await body(req, Export));
  if (!f.ok) throw new ApiError(400, f.error);
  const { rows, total } = await joinLogAll(ctx.db, f.filters, JOIN_LOG_EXPORT_MAX);
  await audit(ctx, "joinlog.export", "join_requests", { ...f.filters, rows: rows.length, total });
  return ok({ filename: joinLogFilename(f.filters, todayIso()), csv: joinLogCsv(rows), rows: rows.length, total });
});
