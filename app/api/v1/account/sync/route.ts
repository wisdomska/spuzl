import { handle, ok, rateLimit, requireUser } from "@/lib/api/server";
import { grantSigninShield } from "@/lib/server/streak-shield";

/**
 * POST /api/v1/account/sync: after a guest links Google or confirms an email, the same user id stays
 * (FR-AC-04), so progress is kept. This marks the player as no longer a guest.
 *
 * R2-P5 streak shield (admin "features.streakShield"): on the first sync after linking, while the row still says
 * guest, one Streak Freeze is granted, once per account (ledger ref, audited). `shield` says what happened, so the
 * screen can tell them; null when nothing was due.
 */
export const POST = handle(async () => {
  const { user, admin } = await requireUser();
  await rateLimit(admin, `account-sync:${user.id}`, 30, 3600);
  const guest = !!user.is_anonymous;
  const shield = guest ? null : await grantSigninShield(admin, user.id);
  const { error } = await admin.from("players").update({ is_guest: guest }).eq("id", user.id);
  if (error) throw error;
  return ok({ guest, email: user.email ?? null, shield });
});
