import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { playerSummaries, shortRef } from "@/lib/admin/moderation";

const Id = z.string().uuid();

/** GET /api/admin/moderation/reports/:id: the report, its target player and other reports on the same target. */
export const GET = handle(async (_req: Request, rc: RouteContext<"/api/admin/moderation/reports/[id]">) => {
  const ctx = await requireAdmin("moderation.read");
  const id = Id.parse((await rc.params).id);
  const { data: r } = await ctx.db.from("reports").select("*").eq("id", id).maybeSingle();
  if (!r) throw new ApiError(404, "report_not_found");
  const { data: related } = await ctx.db
    .from("reports")
    .select("id, reason, status, created_at")
    .eq("target_type", r.target_type)
    .eq("target_id", r.target_id)
    .neq("id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  const players = Id.safeParse(r.target_id).success ? await playerSummaries(ctx.db, [r.target_id, r.reporter_id]) : await playerSummaries(ctx.db, [r.reporter_id]);
  return ok({
    report: { ...r, ref: shortRef("R", r.id) },
    target: players[r.target_id] ?? null,
    reporter: players[r.reporter_id] ? { id: r.reporter_id, nickname: players[r.reporter_id].nickname } : null,
    related: (related ?? []).map((x) => ({ ...x, ref: shortRef("R", x.id) })),
  });
});

const Body = z.object({ decision: z.enum(["dismiss", "actioned", "reopen"]), note: z.string().max(500).optional() });

/** POST /api/admin/moderation/reports/:id: closes a report as dismissed or actioned (or reopens it). */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/moderation/reports/[id]">) => {
  const ctx = await requireAdmin("moderation.write");
  const id = Id.parse((await rc.params).id);
  const { decision, note } = await body(req, Body);
  const status = decision === "dismiss" ? "dismissed" : decision === "actioned" ? "actioned" : "open";
  const { data, error } = await ctx.db
    .from("reports")
    .update({
      status,
      handled_by: status === "open" ? null : ctx.user.id,
      handled_at: status === "open" ? null : new Date().toISOString(),
      resolution: note || null,
    })
    .eq("id", id)
    .select("id, target_type, target_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "report_not_found");
  await audit(ctx, `report.${decision}`, `report:${id}`, { target: `${data.target_type}:${data.target_id}`, note });
  return ok({ ok: true, status });
});
