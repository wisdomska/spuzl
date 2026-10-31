import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { GAME_BY_ID } from "@/lib/catalog";
import { moveGaps, playerSummaries, shortRef } from "@/lib/admin/moderation";
import { dailyNumber } from "@/lib/format";

const Id = z.string().uuid();

/**
 * GET /api/admin/moderation/flagged/:id: a flagged score with its reason and replay data: the move log
 * (input timing), final state, the fastest verified time on the same puzzle and the game's human floor.
 */
export const GET = handle(async (_req: Request, rc: RouteContext<"/api/admin/moderation/flagged/[id]">) => {
  const ctx = await requireAdmin("moderation.read");
  const id = Id.parse((await rc.params).id);
  const { data: a } = await ctx.db
    .from("attempts")
    .select("id, player_id, game_id, mode, daily_date, puzzle_id, started_at, first_move_at, finished_at, time_ms, active_ms, hints, mistakes, deaths, score, state, moves, status, flag_reason, relaxed, offline")
    .eq("id", id)
    .maybeSingle();
  if (!a) throw new ApiError(404, "attempt_not_found");
  const [players, best] = await Promise.all([
    playerSummaries(ctx.db, [a.player_id]),
    a.daily_date
      ? ctx.db.from("daily_results").select("time_ms").eq("game_id", a.game_id).eq("date", a.daily_date).order("time_ms").limit(1).maybeSingle()
      : ctx.db.from("daily_results").select("time_ms").eq("game_id", a.game_id).order("time_ms").limit(1).maybeSingle(),
  ]);
  const meta = GAME_BY_ID[a.game_id];
  const wallMs = a.finished_at ? Date.parse(a.finished_at) - Date.parse(a.started_at) : null;
  return ok({
    attempt: { ...a, ref: shortRef("F", a.id), dailyNumber: a.daily_date ? dailyNumber(a.daily_date) : null },
    game: { id: a.game_id, name: meta?.name ?? a.game_id, world: meta?.world ?? null, minTimeMs: meta?.minTimeMs ?? null },
    player: players[a.player_id] ?? null,
    bestMs: best.data?.time_ms ?? null,
    wallMs,
    gaps: moveGaps(a.moves),
  });
});

const Body = z.object({
  decision: z.enum(["clear", "reject"]),
  note: z.string().max(500).optional(),
  /** reject and ban (days, or null for no end) */
  ban: z.object({ days: z.number().int().min(1).max(365).nullable() }).optional(),
});

/** POST /api/admin/moderation/flagged/:id: clear (publish to boards) or reject the score; optionally ban on reject. */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/moderation/flagged/[id]">) => {
  const ctx = await requireAdmin("moderation.write");
  const id = Id.parse((await rc.params).id);
  const { decision, note, ban } = await body(req, Body);
  const { data, error } = await ctx.db.rpc("svc_admin_resolve_flagged", { p_attempt: id, p_decision: decision, p_actor: ctx.user.id, p_note: note ?? null });
  if (error) {
    if (error.code === "P0002") throw new ApiError(404, "attempt_not_found");
    if (error.code === "P0001") throw new ApiError(409, "not_flagged");
    throw error;
  }
  if (decision === "reject" && ban) {
    const { data: a } = await ctx.db.from("attempts").select("player_id").eq("id", id).single();
    const { error: e2 } = await ctx.db.rpc("svc_admin_player_action", {
      p_player: a!.player_id,
      p_actor: ctx.user.id,
      p_action: "ban_void",
      p_days: ban.days,
      p_reason: note ?? "Flagged score rejected",
      p_nickname: null,
    });
    if (e2) throw e2;
  }
  return ok(data);
});
