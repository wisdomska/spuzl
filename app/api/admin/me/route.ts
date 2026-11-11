import { handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { newFeedbackCount } from "@/lib/admin/feedback-server";
import { PERMISSIONS, can, type Permission } from "@/lib/admin/roles";

/**
 * GET /api/admin/me: the signed-in admin, their role, what it allows and the sidebar counts. AAL2 like every admin
 * route. Counts are things waiting on someone (admin overhaul): open reports and flagged scores, puzzles and content
 * waiting for review, feedback still marked new. Each is null when the role cannot open that page. `puzzles` (every
 * puzzle) stays for older clients.
 */
export const GET = handle(async () => {
  const ctx = await requireAdmin();
  const permissions = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(ctx.role, p));
  const head = { count: "exact" as const, head: true };
  const mod = can(ctx.role, "moderation.read");
  const [puzzles, review, content, reports, flagged, feedback] = await Promise.all([
    ctx.db.from("puzzles").select("id", head),
    can(ctx.role, "calendar.read") ? ctx.db.from("puzzles").select("id", head).eq("status", "in_review") : null,
    can(ctx.role, "content.read") ? ctx.db.from("content_items").select("id", head).eq("source", "editor").eq("status", "in_review") : null,
    mod ? ctx.db.from("reports").select("id", head).eq("status", "open") : null,
    mod ? ctx.db.from("attempts").select("id", head).eq("status", "flagged") : null,
    can(ctx.role, "feedback.read") ? newFeedbackCount(ctx.db) : null,
  ]);
  return ok({
    id: ctx.user.id,
    email: ctx.email,
    role: ctx.role,
    permissions,
    counts: {
      puzzles: puzzles.count ?? 0,
      moderation: reports && flagged ? (reports.count ?? 0) + (flagged.count ?? 0) : null,
      review: review && !review.error ? (review.count ?? 0) : null,
      content: content && !content.error ? (content.count ?? 0) : null,
      feedback: feedback ?? null,
    },
  });
});

/** POST /api/admin/me: records that TOTP is enrolled (reaching here at AAL2 proves it). */
export const POST = handle(async () => {
  const ctx = await requireAdmin();
  const { data } = await ctx.db.from("admins").select("totp_enrolled").eq("user_id", ctx.user.id).single();
  if (!data?.totp_enrolled) {
    await ctx.db
      .from("admins")
      .update({ totp_enrolled: true, email: ctx.user.email ?? null })
      .eq("user_id", ctx.user.id);
    await ctx.db
      .from("audit_log")
      .insert({ actor_id: ctx.user.id, action: "admin.totp_enrolled", target: `admin:${ctx.user.id}`, detail: { role: ctx.role } });
  }
  return ok({ ok: true });
});
