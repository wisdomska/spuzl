import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { ACTION_PERMISSION, ActionBody, confirmMatches } from "@/lib/admin/player-filters";
import { isAdminAccount, safeNickname } from "@/lib/admin/players";
import { can } from "@/lib/admin/roles";
import { deleteAccount } from "@/lib/server/account-delete";

const Id = z.string().uuid();

type PgError = { code?: string; message?: string } | null;

/** Maps the SQL functions' error codes to API errors. */
function fail(error: PgError): never {
  if (error?.code === "P0002") throw new ApiError(404, "player_not_found");
  if (error?.code === "23505") throw new ApiError(409, "nickname_taken");
  if (error?.message?.includes("freeze_full")) throw new ApiError(409, "freeze_full", "This player already holds two Streak Freezes.");
  if (error?.message?.includes("not enough sparks"))
    throw new ApiError(409, "not_enough_sparks", "That would take the balance below zero.");
  if (error?.code === "22023") throw new ApiError(400, "invalid_request", error.message);
  throw error;
}

/**
 * POST /api/admin/players/:id/actions {action, reason, ...}: one player action. Every action needs a reason, is
 * checked against its own permission (ACTION_PERMISSION) here on the server and is written to the audit log (in the
 * same SQL transaction where there is one).
 *   reset_nickname          a generated neutral name ("Puzzler1234")
 *   sparks {amount}         grant or remove Sparks, ±10,000, never below zero (owner)
 *   freeze                  one Streak Freeze, at most two held
 *   ban {days|null}         timed or permanent; unban lifts it
 *   revoke_ranking / restore_ranking
 *   signout                 ends every session (refresh tokens); access tokens lapse within the hour
 *   delete {confirm}        the player's own deletion path, irreversible, confirm repeats the nickname (owner)
 * Admin accounts cannot be signed out or deleted from here.
 */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/players/[id]/actions">) => {
  // Every action needs at least players.moderate; the specific permission is checked once the action is known.
  const ctx = await requireAdmin("players.moderate");
  const id = Id.parse((await rc.params).id);
  // Permission before validation: a role that may not take this action learns nothing about the request shape.
  const raw = (await req
    .clone()
    .json()
    .catch(() => null)) as { action?: unknown } | null;
  const asked = typeof raw?.action === "string" && raw.action in ACTION_PERMISSION ? (raw.action as keyof typeof ACTION_PERMISSION) : null;
  if (asked && !can(ctx.role, ACTION_PERMISSION[asked])) throw new ApiError(403, "forbidden");
  const input = await body(req, ActionBody);
  if (!can(ctx.role, ACTION_PERMISSION[input.action])) throw new ApiError(403, "forbidden");
  const { data: player } = await ctx.db.from("players").select("nickname, age_band").eq("id", id).maybeSingle();
  if (!player) throw new ApiError(404, "player_not_found");

  const playerAction = async (action: string, extra: { days?: number | null; nickname?: string } = {}) => {
    const { data, error } = await ctx.db.rpc("svc_admin_player_action", {
      p_player: id,
      p_actor: ctx.user.id,
      p_action: action,
      p_days: extra.days ?? null,
      p_reason: input.reason,
      p_nickname: extra.nickname ?? null,
    });
    if (error) fail(error);
    return data as object;
  };

  switch (input.action) {
    case "reset_nickname": {
      // A generated name can collide with a taken one; draw again a few times.
      for (let i = 0; i < 5; i++) {
        const nickname = safeNickname();
        const { data, error } = await ctx.db.rpc("svc_admin_player_action", {
          p_player: id,
          p_actor: ctx.user.id,
          p_action: "rename",
          p_days: null,
          p_reason: input.reason,
          p_nickname: nickname,
        });
        if (!error) return ok({ ...(data as object), nickname });
        if (error.code !== "23505") fail(error);
      }
      throw new ApiError(409, "nickname_taken");
    }
    case "sparks": {
      const { data, error } = await ctx.db.rpc("svc_admin_grant_sparks", {
        p_player: id,
        p_actor: ctx.user.id,
        p_amount: input.amount,
        p_reason: input.reason,
      });
      if (error) fail(error);
      return ok(data);
    }
    case "freeze": {
      const { data, error } = await ctx.db.rpc("svc_admin_grant_freeze", { p_player: id, p_actor: ctx.user.id, p_reason: input.reason });
      if (error) fail(error);
      return ok(data);
    }
    case "ban":
      return ok(await playerAction("ban", { days: input.days ?? null }));
    case "unban":
    case "revoke_ranking":
    case "restore_ranking":
      return ok(await playerAction(input.action));
    case "signout": {
      if (await isAdminAccount(ctx, id)) throw new ApiError(409, "is_admin", "This account is on the admin team. Manage it on Team.");
      const { data, error } = await ctx.db.rpc("svc_admin_revoke_sessions", { p_player: id, p_actor: ctx.user.id, p_reason: input.reason });
      if (error) fail(error);
      return ok(data);
    }
    case "delete": {
      if (!confirmMatches(input.confirm, String(player.nickname)))
        throw new ApiError(422, "confirm", "Type the player's nickname exactly to confirm.");
      if (await isAdminAccount(ctx, id)) throw new ApiError(409, "is_admin", "This account is on the admin team. Remove it on Team first.");
      // Logged first, so the trail survives even though everything about the player is about to go.
      await audit(ctx, "player.delete", `player:${id}`, {
        nickname: String(player.nickname),
        age_band: player.age_band,
        reason: input.reason,
      });
      try {
        await deleteAccount(ctx.db, id);
      } catch (e) {
        await audit(ctx, "player.delete_failed", `player:${id}`, { reason: input.reason });
        throw e;
      }
      return ok({ player: id, action: "delete", deleted: true });
    }
  }
});
