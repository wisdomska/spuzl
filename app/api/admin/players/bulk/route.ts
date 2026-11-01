import { body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { BulkBody } from "@/lib/admin/player-filters";

/**
 * POST /api/admin/players/bulk {action: ban|revoke_ranking, ids (1 to 100), reason, days?}: the same action on each
 * selected player. Each one is audited on its own (in SQL, with the reason), then one `player.bulk` row records the
 * batch. Ids that no longer exist are reported back, not failed.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("players.moderate");
  const input = await body(req, BulkBody);
  const done: string[] = [];
  const missing: string[] = [];
  for (const id of input.ids) {
    const { error } = await ctx.db.rpc("svc_admin_player_action", {
      p_player: id,
      p_actor: ctx.user.id,
      p_action: input.action,
      p_days: input.action === "ban" ? (input.days ?? null) : null,
      p_reason: input.reason,
      p_nickname: null,
    });
    if (error?.code === "P0002") missing.push(id);
    else if (error) throw error;
    else done.push(id);
  }
  await audit(ctx, "player.bulk", null, {
    action: input.action,
    days: input.action === "ban" ? (input.days ?? null) : undefined,
    reason: input.reason,
    players: done,
    missing,
  });
  return ok({ action: input.action, done: done.length, missing });
});
