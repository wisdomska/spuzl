import { handle, ok, rateLimit, requireUser } from "@/lib/api/server";

/**
 * POST /api/v1/account/sync: after a guest links Google or confirms an email, the same user id stays
 * (FR-AC-04), so progress is kept. This marks the player as no longer a guest.
 */
export const POST = handle(async () => {
  const { user, admin } = await requireUser();
  await rateLimit(admin, `account-sync:${user.id}`, 30, 3600);
  const guest = !!user.is_anonymous;
  const { error } = await admin.from("players").update({ is_guest: guest }).eq("id", user.id);
  if (error) throw error;
  return ok({ guest, email: user.email ?? null });
});
