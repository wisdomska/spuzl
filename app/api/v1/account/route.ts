import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requireUser } from "@/lib/api/server";
import { deleteAccount } from "@/lib/server/account-delete";

const Delete = z.object({ confirm: z.string().trim() });

/**
 * DELETE /api/v1/account: deletes the account through `deleteAccount` (crews they captain pass on, then the auth
 * user goes and everything about the player cascades from players). The admin console uses the same path.
 * The body must repeat the nickname (or "DELETE" for a player without a profile).
 */
export const DELETE = handle(async (req: Request) => {
  const { user, admin } = await requireUser();
  await rateLimit(admin, `account-delete:${user.id}`, 5, 3600);
  const { confirm } = await body(req, Delete);
  const { data: p } = await admin.from("players").select("nickname").eq("id", user.id).maybeSingle();
  const expected = p?.nickname ?? "DELETE";
  if (confirm.toLowerCase() !== String(expected).toLowerCase()) throw new ApiError(422, "confirm", "Type your nickname to confirm.");
  await deleteAccount(admin, user.id);
  return ok({ ok: true });
});
