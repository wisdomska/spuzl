import { randomInt } from "node:crypto";
import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { playerSummaries } from "@/lib/admin/moderation";
import { nicknameProblem } from "@/lib/validation/nickname";

const Id = z.string().uuid();

/** GET /api/admin/players/:id: moderation summary for one player. */
export const GET = handle(async (_req: Request, rc: RouteContext<"/api/admin/players/[id]">) => {
  const ctx = await requireAdmin("moderation.read");
  const id = Id.parse((await rc.params).id);
  const p = (await playerSummaries(ctx.db, [id]))[id];
  if (!p) throw new ApiError(404, "player_not_found");
  const [{ data: streak }, { count: clears }] = await Promise.all([
    ctx.db.from("streaks").select("current, best").eq("player_id", id).maybeSingle(),
    ctx.db.from("daily_results").select("date", { count: "exact", head: true }).eq("player_id", id),
  ]);
  return ok({ ...p, streak: streak ?? { current: 0, best: 0 }, boardEntries: clears ?? 0 });
});

const Body = z.object({
  action: z.enum(["ban", "ban_void", "unban", "revoke_ranking", "restore_ranking", "reset", "rename"]),
  days: z.number().int().min(1).max(365).nullable().optional(),
  reason: z.string().trim().max(500).optional(),
  /** rename: the new nickname, or omit for a neutral "Puzzler1234" */
  nickname: z.string().trim().max(16).optional(),
});

/**
 * POST /api/admin/players/:id: ban (timed or not, optionally voiding times), unban, revoke or restore
 * ranking, reset (void times, ratings and streak), or rename after a nickname report. Audited in SQL.
 */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/players/[id]">) => {
  const ctx = await requireAdmin("moderation.write");
  const id = Id.parse((await rc.params).id);
  const b = await body(req, Body);
  let nickname: string | null = null;
  if (b.action === "rename") {
    // Leet digits can spell a blocked word ("Puzzler4551"), so draw until the filter passes.
    nickname = b.nickname || "";
    for (let i = 0; !nickname && i < 50; i++) {
      const n = `Puzzler${randomInt(1000, 10000)}`;
      if (!nicknameProblem(n)) nickname = n;
    }
    const problem = nicknameProblem(nickname);
    if (problem) throw new ApiError(422, "bad_nickname", problem);
  }
  const { data, error } = await ctx.db.rpc("svc_admin_player_action", {
    p_player: id,
    p_actor: ctx.user.id,
    p_action: b.action,
    p_days: b.days ?? null,
    p_reason: b.reason || null,
    p_nickname: nickname,
  });
  if (error) {
    if (error.code === "P0002") throw new ApiError(404, "player_not_found");
    if (error.code === "23505") throw new ApiError(409, "nickname_taken");
    throw error;
  }
  return ok({ ...(data as object), nickname });
});
