import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { playerSummaries, shortRef } from "@/lib/admin/moderation";
import { blockFromAdultParty } from "@/lib/multiplayer/server/adult";
import { getGameSettings } from "@/lib/game-settings/server";

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
  const players = Id.safeParse(r.target_id).success
    ? await playerSummaries(ctx.db, [r.target_id, r.reporter_id])
    : await playerSummaries(ctx.db, [r.reporter_id]);
  return ok({
    report: { ...r, ref: shortRef("R", r.id) },
    target: players[r.target_id] ?? null,
    reporter: players[r.reporter_id] ? { id: r.reporter_id, nickname: players[r.reporter_id].nickname } : null,
    related: (related ?? []).map((x) => ({ ...x, ref: shortRef("R", x.id) })),
    // 18+ party content: how long "Mark actioned" keeps the player out of 18+ rooms
    blockDays: r.target_type === "party" ? (await getGameSettings())["adultParty.blockDays"] : null,
  });
});

const Body = z.object({ decision: z.enum(["dismiss", "actioned", "reopen"]), note: z.string().max(500).optional() });

/**
 * POST /api/admin/moderation/reports/:id: closes a report as dismissed or actioned (or reopens it). Actioning
 * an 18+ party content report also blocks the reported player from 18+ party rooms ("adultParty.blockDays");
 * taking that back (reopen or dismiss) lifts the block, unless another actioned party report on the player still
 * justifies one (svc_adult_party_lift_block, which audits the change).
 */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/moderation/reports/[id]">) => {
  const ctx = await requireAdmin("moderation.write");
  const id = Id.parse((await rc.params).id);
  const { decision, note } = await body(req, Body);
  const status = decision === "dismiss" ? "dismissed" : decision === "actioned" ? "actioned" : "open";
  const { data: was } = await ctx.db.from("reports").select("status").eq("id", id).maybeSingle();
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
  const party = data.target_type === "party" && Id.safeParse(data.target_id).success;
  let blockedUntil: string | null = null;
  let blockLifted = false;
  if (party && status === "actioned") blockedUntil = await blockFromAdultParty(ctx.db, data.target_id);
  else if (party && was?.status === "actioned") {
    const { data: lift, error: liftError } = await ctx.db.rpc("svc_adult_party_lift_block", {
      p_player: data.target_id,
      p_report: id,
      p_days: (await getGameSettings())["adultParty.blockDays"],
      p_actor: ctx.user.id,
    });
    // PGRST202: the 20261114000001 migration isn't applied yet; the block stays, as before.
    if (liftError && liftError.code !== "PGRST202") throw liftError;
    if (!liftError) {
      const r = lift as { changed: boolean; blockedUntil: string | null };
      blockLifted = r.changed;
      blockedUntil = r.blockedUntil;
    }
  }
  await audit(ctx, `report.${decision}`, `report:${id}`, {
    target: `${data.target_type}:${data.target_id}`,
    note,
    blockedUntil,
    ...(blockLifted ? { blockLifted } : {}),
  });
  return ok({ ok: true, status, blockedUntil, blockLifted });
});
