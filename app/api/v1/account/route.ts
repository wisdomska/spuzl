import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requireUser } from "@/lib/api/server";

const Delete = z.object({ confirm: z.string().trim() });

/**
 * DELETE /api/v1/account: deletes the auth user. Everything about the player cascades from players
 * (attempts, results, ledgers, friends, feed, inventory, crews they own, reports they filed).
 * The body must repeat the nickname (or "DELETE" for a player without a profile).
 */
export const DELETE = handle(async (req: Request) => {
  const { user, admin } = await requireUser();
  await rateLimit(admin, `account-delete:${user.id}`, 5, 3600);
  const { confirm } = await body(req, Delete);
  const { data: p } = await admin.from("players").select("nickname").eq("id", user.id).maybeSingle();
  const expected = p?.nickname ?? "DELETE";
  if (confirm.toLowerCase() !== String(expected).toLowerCase()) throw new ApiError(422, "confirm", "Type your nickname to confirm.");
  // Crews they captain pass to the next member instead of vanishing with everyone in them.
  const { data: owned } = await admin.from("crews").select("id").eq("owner_id", user.id);
  for (const c of owned ?? []) {
    const { data: next } = await admin
      .from("crew_members")
      .select("player_id")
      .eq("crew_id", c.id)
      .neq("player_id", user.id)
      .order("joined_at")
      .limit(1);
    if (next?.length) {
      await admin.from("crews").update({ owner_id: next[0].player_id }).eq("id", c.id);
      await admin.from("crew_members").update({ role: "captain" }).eq("crew_id", c.id).eq("player_id", next[0].player_id);
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
  return ok({ ok: true });
});
